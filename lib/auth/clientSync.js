"use client";

import axios from "axios";
import { useUserStore } from "../../stores/user";

let registeredQueryClient = null;

export function registerAuthQueryClient(queryClient) {
  registeredQueryClient = queryClient || null;
}

export function invalidateAuth(queryClient = registeredQueryClient) {
  queryClient?.removeQueries({ queryKey: ["user"] });
  useUserStore.setState({ user: null });
}

// Phase 7 — cross-tab synchronization.
//
// BroadcastChannel is the primary transport; we fall back to the `storage`
// event for browsers that lack it (and to dodge `BroadcastChannel`
// constructor edge cases on some mobile WebViews). Both transports carry the
// same message envelope — `{ type, ts, payload }` — and are ignored when
// `window` is undefined (server-side renders, tests).
//
// `BroadcastChannel.postMessage` does NOT echo to the originating document,
// and a `storage` event is only delivered to other documents — so handlers
// don't see their own broadcasts.

let channel = null;

function ensureChannel() {
  if (channel || typeof globalThis === "undefined") return;
  // `globalThis.BroadcastChannel` (rather than the bareword) avoids the
  // ESM strict-mode `ReferenceError` for undeclared globals.
  if (typeof globalThis.BroadcastChannel === "undefined") return;
  try {
    channel = new globalThis.BroadcastChannel("auth");
  } catch {
    channel = null;
  }
}

export function broadcastAuth(type, payload = null) {
  const message = { type, ts: Date.now(), payload };
  try {
    ensureChannel();
    channel?.postMessage(message);
  } catch {
    // BroadcastChannel threw (closed channel, etc.) — storage fallback still applies.
  }
  try {
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      // `localStorage.setItem` with the same value does not fire a `storage`
      // event in some browsers; encode the timestamp so each broadcast is
      // unique.
      globalThis.localStorage.setItem("auth_event", JSON.stringify(message));
    }
  } catch {
    // localStorage unavailable (Safari private mode, etc.) — best effort.
  }
}

let installedHandler = null;

export function installAuthSync(handler) {
  if (typeof globalThis === "undefined" || typeof handler !== "function") {
    return () => {};
  }
  ensureChannel();

  if (channel) {
    channel.onmessage = (event) => {
      try { handler(event.data); } catch (err) { console.error("auth-sync handler:", err); }
    };
  }

  const onStorage = (event) => {
    if (event.key !== "auth_event" || !event.newValue) return;
    try { handler(JSON.parse(event.newValue)); } catch (err) { console.error("auth-sync storage handler:", err); }
  };
  globalThis.addEventListener("storage", onStorage);

  installedHandler = handler;
  return () => {
    globalThis.removeEventListener("storage", onStorage);
    if (channel) channel.onmessage = null;
    installedHandler = null;
  };
}

// Phase 6 — the single client logout pipeline.
//
// Order of operations (see the auth refactor plan §12):
//   1. POST /api/auth/logout  → server flag-revokes the session and clears
//      both auth cookies.
//   2. invalidateAuth()       → React Query ["user"] cache removed and the
//      Zustand mirror cleared atomically (fixes "UI still shows the user
//      after logout" — one click, no browser refresh).
//   3. broadcastAuth(broadcastType) → cross-tab tabs invalidate and redirect.
//   4. router.refresh()       → server components re-render with the now
//      absent cookies.
//   5. router.push(redirectTo) → leave the authenticated area.
//
// The `finally` block guarantees the client converges to unauthenticated even
// if the logout request fails on the network — the session may still be valid
// server-side, but leaving a rendered authenticated UI stranded is worse than
// forcing a re-authentication. Returns the axios response (or null on
// failure) so callers can surface the server's message.
export async function performClientLogout({
  router,
  queryClient,
  redirectTo = "/",
  broadcastType = "logout",
} = {}) {
  let response = null;
  try {
    response = await axios.post("/api/auth/logout");
  } catch (err) {
    console.error("Logout request failed:", err);
  } finally {
    invalidateAuth(queryClient);
    broadcastAuth(broadcastType);
    if (router) {
      router.refresh();
      router.push(redirectTo);
    }
  }
  return response;
}
