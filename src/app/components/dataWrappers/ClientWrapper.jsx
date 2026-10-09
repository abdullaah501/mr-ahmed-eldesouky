"use client";

import { useUser } from "../../../../hooks/useUser";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "../../../../stores/user";
import useIsNewDevice from "../isNewDevice/useIsNewDevice";
import NotificationBell from "../notifications/NotificationBell";
import {
  invalidateAuth,
  installAuthSync,
} from "../../../../lib/auth/clientSync";

function generateClientId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
  }
  return "client-" + Math.random().toString(36).slice(2) + "-" + Date.now();
}

function emitClient(event, fields) {
  try {
    const clientId = (typeof window !== "undefined" && window.__trace_client_id) || null;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ts_hr: (typeof performance !== "undefined" ? performance.now() * 1e6 : Date.now() * 1e6).toString(),
      req_id: null,
      client_id: clientId,
      event: "client_" + event,
      source: "ClientWrapper",
      fields: fields || {},
    });
    console.log(line);
  } catch {
  }
}

export default function ClientWrapper({ user: initialUser, children }) {
  if (typeof window !== "undefined" && !window.__trace_client_id) {
    window.__trace_client_id = generateClientId();
  }

  emitClient("ClientWrapper_mount", { initialUser_present: Boolean(initialUser) });

  const router = useRouter();
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);
  const checkAuthCookies = useUserStore((state) => state.checkAuthCookies);
  const { data: user, isLoading, error } = useUser(
    initialUser ? JSON.parse(initialUser) : null
  );

  useIsNewDevice();

  // Phase 7 — cross-tab sync.
  //
  // Tab A logouts/role-changes/replays broadcast over the `auth` channel;
  // Tab B's handler invalidates the local auth state and refreshes server
  // components. Forced session-expiry (`session-expired`) also redirects to
  // `/login`; user-initiated `logout` only invalidates + refreshes, leaving
  // the user's current page readable.
  useEffect(() => {
    const unsubscribe = installAuthSync((message) => {
      if (!message || typeof message !== "object" || !message.type) return;
      invalidateAuth(queryClient);
      router.refresh();
      if (message.type === "session-expired") {
        router.push("/login");
      }
    });
    return unsubscribe;
  }, [router, queryClient]);

  useEffect(() => {
    emitClient("ClientWrapper_useEffect", {
      has_error: Boolean(error),
      is_loading: isLoading,
      has_user: Boolean(user),
    });
    if (error) {
      console.error("Error fetching user:", error);
    }

    if (!isLoading && !user) {
      checkAuthCookies();
    }

    if (!isLoading && user) {
      console.log("Setting user in store:", user);
      setUser(user);
    }
  }, [user, isLoading, error, checkAuthCookies, setUser]);


  return (
    <div className="overflow-x-clip">
      {user && user.role !== "admin" ? (
        <div className="fixed top-20 right-4 z-99 md:top-4">
          <NotificationBell />
        </div>
      ) : null}
      {children}
    </div>
  );

}
