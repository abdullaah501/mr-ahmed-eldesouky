"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  FiPlay,
  FiPause,
  FiMaximize,
  FiMinimize,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";

function formatTime(s) {
  const n = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(n / 60);
  const sec = n % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Zoom recordings expose their own closed player — rendered contained,
 * no external-control claims.
 */
function ZoomEmbed({ embedUrl }) {
  let safeUrl = null;
  try {
    const u = new URL(embedUrl);
    safeUrl =
      u.protocol === "https:" && u.hostname.toLowerCase().endsWith("zoom.us")
        ? u.toString()
        : null;
  } catch {}
  if (!safeUrl) {
    return (
      <p className="text-center py-10 text-sm text-foreground/50">
        Recording link unavailable
      </p>
    );
  }
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black"
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={safeUrl}
        title="Zoom recording"
        allow="fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}

export default function LecturePlayer({ recording, title }) {
  const wrapperRef = useRef(null);
  const ytContainerRef = useRef(null);
  const videoRef = useRef(null);

  const [providerReady, setProviderReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fallbackFs, setFallbackFs] = useState(false);
  const [error, setError] = useState(null);

  const isYoutube = recording?.provider === "youtube";
  const isZoom = recording?.provider === "zoom";
  const hasRecording = isYoutube || isZoom;

  // ── YouTube provider wiring (reuses the existing provider seam).
  useEffect(() => {
    if (!isYoutube || !recording?.youtubeVideoId) return undefined;

    let disposed = false;
    let provider = null;
    const cleanupRef = { current: null };

    (async () => {
      const { createVideoProvider } =
        await import("./video/videoProvider/createVideoProvider");
      if (disposed) return;
      provider = createVideoProvider({
        provider: "youtube",
        fileKey: recording.youtubeVideoId,
        videoRef,
        ytContainerRef,
        callbacks: {
          onLoading: () => {},
          // Provider calls onError(null) in init()/refresh() to CLEAR a stale
          // error — only a non-null message means a real playback failure.
          // Using ?? prevents the clear signal from latching the fallback.
          onError: (msg) => setError(msg ?? null),
        },
      });
      const facade = provider.facade;

      const onTime = () => {
        setCurrentTime(facade.currentTime || 0);
        const d = facade.duration;
        if (typeof d === "number" && d > 0) setDuration(d);
      };
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      const onEnded = () => {
        setPlaying(false);
        setCurrentTime(facade.duration || facade.currentTime || 0);
      };

      facade.addEventListener("timeupdate", onTime);
      facade.addEventListener("play", onPlay);
      facade.addEventListener("pause", onPause);
      facade.addEventListener("ended", onEnded);

      videoRef.current = facade;
      provider.init();
      setProviderReady(true);

      // Cleanup closure uses latest refs.
      cleanupRef.current = () => {
        facade.removeEventListener("timeupdate", onTime);
        facade.removeEventListener("play", onPlay);
        facade.removeEventListener("pause", onPause);
        facade.removeEventListener("ended", onEnded);
        try {
          provider.destroy();
        } catch {}
      };
    })();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      setProviderReady(false);
      setPlaying(false);
    };
  }, [isYoutube, recording?.youtubeVideoId]);

  // ── Fullscreen on the LMS wrapper (controls stay DOM children of it).
  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) setFallbackFs(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const enterFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setFallbackFs(true));
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      // iOS Safari (iPhone): element fullscreen unsupported — in-page
      // maximization keeps the custom controls usable instead.
      setFallbackFs(true);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (
      document.webkitExitFullscreen &&
      document.webkitFullscreenElement
    ) {
      document.webkitExitFullscreen();
    }
    setFallbackFs(false);
  }, []);

  // ── Custom controls drive the YouTube IFrame API through the facade.
  const facade = () => videoRef.current;

  const togglePlay = () => {
    const f = facade();
    if (!f) return;
    if (playing) f.pause();
    else f.play();
  };

  const seekTo = (v) => {
    const f = facade();
    if (!f) return;
    f.currentTime = Number(v);
    setCurrentTime(Number(v));
  };

  const toggleMute = () => {
    const f = facade();
    if (!f) return;
    if (muted) {
      f.unmute?.();
      setMuted(false);
    } else {
      f.mute?.();
      setMuted(true);
    }
  };

  const changeVolume = (v) => {
    const f = facade();
    const val = Number(v);
    setVolume(val);
    if (!f) return;
    f.setVolume?.(val);
    if (val > 0 && muted) {
      f.unmute?.();
      setMuted(false);
    }
  };

  const shellStyle = useMemo(
    () =>
      fallbackFs
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "var(--background, #000)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }
        : {},
    [fallbackFs],
  );

  if (!hasRecording) {
    return (
      <p className="text-center py-8 text-sm text-foreground/50">
        لا يوجد تسجيل لهذه المحاضرة بعد
      </p>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={shellStyle}
      className={`w-full ${fallbackFs ? "px-4" : ""}`}
      dir="ltr"
    >
      <div
        className={`relative w-full bg-black rounded-xl overflow-hidden select-none ${
          fallbackFs ? "max-h-[85vh]" : ""
        }`}
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* YouTube provider mounts its pre-created iframe here */}
        <div ref={ytContainerRef} className="absolute inset-0" />

        {/* Interaction shield — swallows taps/clicks aimed at YouTube's
            chrome/title/watch-later so normal navigation stays inside the
            LMS. All playback goes through the custom controls below. */}
        {isYoutube && (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ zIndex: 5 }}
            onDoubleClick={togglePlay}
          />
        )}

        {isYoutube && error && (
          <div
            className="absolute inset-0 flex items-center justify-center text-white text-sm px-6 text-center"
            style={{ zIndex: 6, direction: "ltr" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Custom LMS control layer */}
      {isYoutube && (
        <div
          className={`flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-b-xl border-x border-b border-foreground/10 bg-background ${
            fallbackFs
              ? "max-w-3xl mx-auto w-full mt-auto mb-6 rounded-xl border"
              : ""
          }`}
          dir="ltr"
        >
          <button
            type="button"
            onClick={togglePlay}
            disabled={!providerReady}
            className="p-2 rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-40"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <FiPause size={18} /> : <FiPlay size={18} />}
          </button>

          <span
            className="text-[11px] font-mono text-foreground/70 tabular-nums"
            dir="ltr"
          >
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seekTo(e.target.value)}
            disabled={!providerReady || !duration}
            className="flex-1 min-w-[120px] accent-[var(--primary,#3b82f6)] disabled:opacity-40"
            title="Seek"
          />

          <span
            className="text-[11px] font-mono text-foreground/70 tabular-nums"
            dir="ltr"
          >
            {formatTime(duration)}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            disabled={!providerReady}
            className="p-2 rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-40"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(e.target.value)}
            disabled={!providerReady}
            className="w-20 accent-[var(--primary,#3b82f6)] hidden sm:block disabled:opacity-40"
            title="Volume"
          />

          <button
            type="button"
            onClick={() =>
              isFullscreen || fallbackFs ? exitFullscreen() : enterFullscreen()
            }
            className="p-2 rounded-lg hover:bg-foreground/5 transition-colors"
            title={
              isFullscreen || fallbackFs ? "Exit fullscreen" : "Fullscreen"
            }
          >
            {isFullscreen || fallbackFs ? (
              <FiMinimize size={16} />
            ) : (
              <FiMaximize size={16} />
            )}
          </button>
        </div>
      )}

      {isZoom && <ZoomEmbed embedUrl={recording.embedUrl} />}

      {title && !fallbackFs && (
        <p className="mt-2 text-xs text-foreground/50 truncate" dir="ltr">
          {title}
        </p>
      )}
    </div>
  );
}
