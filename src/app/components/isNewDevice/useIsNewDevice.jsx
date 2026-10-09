"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { performClientLogout } from "../../../../lib/auth/clientSync";

function emitClient(event, fields) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ts_hr: (typeof performance !== "undefined" ? performance.now() * 1e6 : Date.now() * 1e6).toString(),
      req_id: null,
      client_id: null,
      event: "client_" + event,
      source: "useIsNewDevice",
      fields: fields || {},
    });
    console.log(line);
  } catch {
  }
}

export default function useIsNewDevice() {
  const router = useRouter();
  const queryClient = useQueryClient();

    const handleLogout = async () => {
      emitClient("useIsNewDevice_handleLogout_start", {});
      // The session is already revoked server-side (isExp=true). Route the
      // cleanup through the same single logout pipeline used by LogoutBtn:
      // idempotent POST (clears cookies locally) + invalidateAuth + navigate.
      // Broadcast `session-expired` so other open tabs also converge to
      // unauthenticated immediately rather than waiting for their own SSE
      // event or the next 401.
      await performClientLogout({
        router,
        queryClient,
        redirectTo: "/login",
        broadcastType: "session-expired",
      });
      emitClient("useIsNewDevice_handleLogout_done", {});
    };

  useEffect(() => {
    emitClient("useIsNewDevice_effect_start", {});
    const eventSource = new EventSource("/api/stream/isNewDevice");
    let loggedOut = false;

    eventSource.onopen = () => {
      emitClient("useIsNewDevice_sse_open", {});
    };

    eventSource.onmessage = (event) => {
      if (loggedOut) return;

      try {
        const data = JSON.parse(event.data);
        emitClient("useIsNewDevice_sse_message", { data });

        if (data.isExp) {
          loggedOut = true;
          emitClient("useIsNewDevice_isExp_detected", { data });
          handleLogout();
        }
      } catch (error) {
        emitClient("useIsNewDevice_sse_parse_error", { message: error?.message });
        console.error("Invalid SSE data:", error);
      }
    };

    eventSource.onerror = (err) => {
      emitClient("useIsNewDevice_sse_error", { message: err?.message || "unknown" });
      console.error("SSE connection error:", err);
      eventSource.close();
    };

    return () => {
      emitClient("useIsNewDevice_cleanup", {});
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return;
}
