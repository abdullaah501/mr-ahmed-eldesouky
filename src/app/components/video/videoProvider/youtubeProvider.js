// videoProvider/youtubeProvider.js
//
// YouTube provider for LecturePlayer. Exposes the shared provider surface:
// { init, refresh, destroy, render, facade }.
//
// `facade` is a video-element-compatible object for the player controls. It is
// created synchronously so controls can assign it before the IFrame API is
// loaded. The internal YT.Player is loaded lazily inside init().
//
// Tick strategy: YouTube's IFrame API exposes only state-change events
// (onReady / onStateChange / onError). It has NO timeupdate event. We
// therefore drive "timeupdate" emissions from requestAnimationFrame while
// the player reports PLAYING. No timer polling is used.
//
// Privacy: uses youtube-nocookie.com (Privacy Enhanced Mode) by constructing
// the embed URL directly in the pre-created iframe. Player params: rel=0,
// iv_load_policy=3/disablekb/playsinline/fs=1. The AES-128 secure label is
// The LMS does not claim DRM or prevent determined users from discovering the
// underlying embed identifier.

import React from "react";

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

// Module-level singleton for the IFrame API. Multiple VideoPlayer instances
// (multi-video lessons) share one script load and one onYouTubeIframeAPIReady
// dispatch.
let apiReady = false;
let apiLoading = null;
const pendingPlayers = [];

let _ytPid = 0;
let _ytFid = 0;

function loadIFrameApi() {
  if (apiReady) return Promise.resolve();
  if (apiLoading) return apiLoading;
  apiLoading = new Promise((resolve) => {
    if (typeof window === "undefined") return;
    // Preserve a user/extension-installed callback chain.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === "function") {
        try { previous(); } catch {}
      }
      apiReady = true;
      apiLoading = null;
      resolve();
      // Flush any providers that mounted while the API was downloading.
      while (pendingPlayers.length) {
        const fn = pendingPlayers.shift();
        try { fn(); } catch (e) { console.error("YT player init (deferred) failed:", e); }
      }
    };
    if (!document.querySelector(`script[src="${IFRAME_API_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = IFRAME_API_SRC;
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return apiLoading;
}

/**
 * createYouTubeProvider
 * @param {Object} opts
 * @param {string} opts.fileKey      - the YouTube videoId (acts as `videoKey`
 *                                     for the completion/redis pipeline too)
 * @param {Object} opts.videoRef     - React ref shared with LecturePlayer
 *                                     (the facade is assigned to it)
 * @param {Object} opts.ytContainerRef - React ref pointing at the mount <div>
 * @param {Object} opts.callbacks    - { onLoading, onError }
 */
export function createYouTubeProvider({ fileKey, videoRef, ytContainerRef, callbacks }) {
  const { onLoading, onError } = callbacks;
  const videoId = fileKey;

  // ── Provider state
  let player = null;
  let cachedTime = 0;
  let cachedDuration = 0;
  let rafId = null;
  let destroyed = false;

  // ── Internal emitter (also the DOM-subset event surface)
  const listeners = new Map();
  function on(ev, cb) {
    console.log("[YT LISTENER +]", { event: ev, before: listeners.get(ev)?.size ?? 0 });
    if (!listeners.has(ev)) listeners.set(ev, new Set());
    listeners.get(ev).add(cb);
    console.log("[YT LISTENER ADDED]", { event: ev, after: listeners.get(ev)?.size ?? 0 });
  }
  function off(ev, cb) {
    console.log("[YT LISTENER -]", { event: ev, before: listeners.get(ev)?.size ?? 0 });
    listeners.get(ev)?.delete(cb);
    console.log("[YT LISTENER REMOVED]", { event: ev, after: listeners.get(ev)?.size ?? 0 });
  }
  function emit(ev, ...args) {
    console.log("[YT TRACE 4] emit()", { event: ev, listeners: listeners.get(ev)?.size ?? 0 });
    listeners.get(ev)?.forEach((cb) => { try { cb(...args); } catch {} });
  }

  // ── rAF tick loop (event-started/stopped, frame-synced cadence)
  function startRaf() {
    console.log("[YT TRACE 2] startRaf()", { destroyed, rafId });
    if (rafId !== null || destroyed) return;
    console.log("[YT TRACE 2] startRaf ENTERED");
    const loop = () => {
      if (destroyed || !player) { rafId = null; return; }
      try {
        cachedTime = player.getCurrentTime();
        console.log("[YT TRACE 3] loop()", { currentTime: cachedTime, duration: cachedDuration });
        const d = player.getDuration();
        if (typeof d === "number" && d > 0) cachedDuration = d;
      } catch {}
      emit("timeupdate");
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }
  function stopRaf() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ── YT callbacks
  function onReady() {
    if (destroyed) return;
    try {
      const iframe = player?.getIframe?.();
      if (iframe) {
        const allow = iframe.getAttribute("allow") || "";
        if (!allow.includes("fullscreen")) {
          iframe.setAttribute("allow", allow ? `${allow}; fullscreen` : "fullscreen");
        }
      }
    } catch {}
    try {
      const d = player?.getDuration?.();
      if (typeof d === "number" && d > 0) cachedDuration = d;
    } catch {}
    onLoading(false);
  }

  function onStateChange(e) {
    console.log("[YT TRACE 1] onStateChange", {
      state: e.data,
      destroyed,
      hasPlayer: !!player,
      rafId,
    });
    if (destroyed) return;
    const state = e.data;
    const YT = window.YT;
    if (!YT) return;
    if (state === YT.PlayerState.PLAYING) {
      try {
        const d = player?.getDuration?.();
        if (typeof d === "number" && d > 0) cachedDuration = d;
      } catch {}
      emit("play");
      startRaf();
    } else if (state === YT.PlayerState.PAUSED) {
      try { cachedTime = player?.getCurrentTime?.() ?? cachedTime; } catch {}
      emit("pause");
      stopRaf();
    } else if (state === YT.PlayerState.ENDED) {
      cachedTime = cachedDuration;
      emit("ended");
      stopRaf();
    }
    // BUFFERING / CUED: leave the rAF loop as-is (BUFFERING pauses time advance
    // naturally — decideTick becomes a no-op while currentTime doesn't move).
  }

  function onPlayerError(e) {
    if (destroyed) return;
    const code = e?.data;
    let msg = "Unable to play this YouTube video";
    if (code === 101 || code === 150) msg = "This video is restricted from being embedded";
    onError(msg);
    stopRaf();
  }

  // ── Facade — the object LecturePlayer sees as `videoRef.current`. Implements the
  // HTMLVideoElement subset the adapter actually uses (see lib/timeline/
  // videoAdapter.js) plus the clean provider interface.
  const facade = {
    destroyed: false,
    // DOM-subset surface used by attachTick / adapterPause / adapterPlay / adapterSeek
    addEventListener: on,
    removeEventListener: off,
    // engine-internal "play"-guard listens to "play" so it can re-pause under
    // an active overlay; emit it from onStateChange so the guard works on YT
    // (otherwise students could resume under a blocking question).
    requestVideoFrameCallback() { return 0; /* no-op; ticks come from "timeupdate" emitted by rAF */ },
    cancelVideoFrameCallback() {},
    get currentTime() { return cachedTime; },
    set currentTime(v) {
      cachedTime = v;
      try { player?.seekTo(v, true); } catch {}
    },
    get duration() { return cachedDuration; },
    play() {
      try { player?.playVideo(); } catch {}
      return Promise.resolve();
    },
    pause() { try { player?.pauseVideo(); } catch {} },
    // Clean provider interface
    seek(s) { try { player?.seekTo(s, true); } catch {} },
    getCurrentTime() { return cachedTime; },
    getDuration() { return cachedDuration; },
    isPaused() { return !player || window.YT?.PlayerState?.PLAYING !== undefined && player.getPlayerState() !== window.YT.PlayerState.PLAYING; },
    // Volume control surface for the LMS custom player layer (LecturePlayer).
    setVolume(v) { try { player?.setVolume(Math.max(0, Math.min(100, Math.round(v * 100)))); } catch {} },
    getVolume() { try { return (player?.getVolume?.() ?? 100) / 100; } catch { return 1; } },
    mute() { try { player?.mute(); } catch {} },
    unmute() { try { player?.unMute(); } catch {} },
    isMuted() { try { return !!player?.isMuted?.(); } catch { return false; } },
    on, off,
    destroy() {},
  };

  function createPlayer() {
    const container = ytContainerRef.current;
    if (!container || destroyed || player) return;

    // Create the iframe OURSELVES with the correct `allow` and
    // `allowfullscreen` attributes BEFORE the browser starts the frame's
    // navigation. Per the Permissions Policy spec, the browser computes the
    // frame's effective permissions from the `allow` attribute at the moment
    // the frame's navigation starts (when src is set), NOT dynamically
    // afterward. The YouTube IFrame API's default flow (passing a <div>)
    // creates the iframe internally with an `allow` list that omits
    // "fullscreen", and a later setAttribute("allow", "...;fullscreen") runs
    // too late — the policy is already cached as "no fullscreen".
    //
    // By pre-creating the iframe with `allow` (including "fullscreen") and a
    // fully-formed src URL, the permissions policy is correct from the very
    // first navigation. The YouTube IFrame API detects the existing iframe and
    // attaches its player layer to it rather than replacing it.
    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
    );
    iframe.setAttribute("allowfullscreen", "");
    iframe.style.position = "absolute";
    iframe.style.inset = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({
      enablejsapi: "1",
      origin,
      rel: "0",
      playsinline: "1",
      fs: "1",
      disablekb: "1",
      iv_load_policy: "3",
      cc_load_policy: "0",
      controls: "1",
    });
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    container.appendChild(iframe);

    // When passing an existing iframe, the API attaches to it instead of
    // creating a new one. Only `events` is needed — videoId, width, height,
    // and playerVars come from the iframe's src URL (per YouTube IFrame API
    // documentation).
    player = new window.YT.Player(iframe, {
      events: { onReady, onStateChange, onError: onPlayerError },
    });

    // Safety net: ensure allow attribute remains correct even if the API
    // internally recreates the iframe.
    try {
      const finalIframe = player.getIframe();
      if (finalIframe) {
        const allow = finalIframe.getAttribute("allow") || "";
        if (!allow.includes("fullscreen")) {
          finalIframe.setAttribute("allow", allow ? `${allow}; fullscreen` : "fullscreen");
        }
        console.log("[YT DEBUG] allow at creation:", finalIframe.getAttribute("allow"));
        console.log("[YT DEBUG] src set:", finalIframe.src);
      }
    } catch {}
  }

  // ── Public lifecycle
  const _pid = ++_ytPid;
  const _fid = ++_ytFid;
  facade._fid = _fid;

  function init() {
    const _t = performance.now().toFixed(1);
    const prev = facade._mapSizeAtDestroy; // set by destroy()
    console.log("[YT INIT]", {
      time: _t,
      providerId: _pid,
      facadeId: _fid,
      mapSizeBeforeInit: listeners.size,
      mapSizeAtDestroy: prev ?? "N/A",
    });
    delete facade._mapSizeAtDestroy;
    destroyed = false;
    facade.destroyed = false;
    onLoading(true);
    onError(null);
    if (apiReady) {
      createPlayer();
    } else {
      if (!pendingPlayers.includes(createPlayer)) {
        pendingPlayers.push(createPlayer);
      }
      loadIFrameApi();
    }
  }

  function refresh() {
    // Recreate the player (no token to refresh for YouTube).
    onError(null);
    onLoading(true);
    destroy();
    init();
  }

  function destroy() {
    {
      const _t = performance.now().toFixed(1);
      const vu = videoRef?.current;
      console.log("[YT DESTROY] before", {
        time: _t,
        providerId: _pid,
        facadeId: _fid,
        mapSize: listeners.size,
        mapEvents: Array.from(listeners.keys()),
        videoRefCurrent: vu === null ? "null" : vu === undefined ? "undefined" : vu?.constructor?.name ?? typeof vu,
      });
      facade._mapSizeAtDestroy = listeners.size;
    }
    destroyed = true;
    facade.destroyed = true;
    stopRaf();
    try { player?.destroy?.(); } catch {}
    player = null;
    if (ytContainerRef.current) ytContainerRef.current.innerHTML = "";
    const i = pendingPlayers.indexOf(createPlayer);
    if (i !== -1) pendingPlayers.splice(i, 1);
    {
      const _t = performance.now().toFixed(1);
      console.log("[YT DESTROY] after", {
        time: _t,
        facilitatorId: _fid,
        mapSize: listeners.size,
        videoRefCurrent: videoRef?.current === null ? "null" : videoRef?.current?.constructor?.name ?? typeof videoRef?.current,
      });
    }
  }

  // ── Public render element (mount <div> React owns; YT.Player injects the
  // iframe into it during init)
  function render({ ytContainerRef: cr, style }) {
    return (
      <div
        ref={cr}
        style={{
          ...style,
          position: "relative",
          height: "auto",
          aspectRatio: "16 / 9",
          overflow: "hidden",
        }}
      />
    );
  }

  return { init, refresh, destroy, render, facade, secureLabel: false };
}
