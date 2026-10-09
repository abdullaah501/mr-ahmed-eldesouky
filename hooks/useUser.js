// hooks/useUser.js
"use client";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useUserStore } from "../stores/user";

function emitClient(event, fields) {
  try {
    if (typeof window === "undefined") return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ts_hr: (typeof performance !== "undefined" ? performance.now() * 1e6 : Date.now() * 1e6).toString(),
      req_id: (typeof window !== "undefined" && window.__trace_client_id) || null,
      client_id: (typeof window !== "undefined" && window.__trace_client_id) || null,
      event: "client_" + event,
      source: "useUser",
      fields: fields || {},
    });
    console.log(line);
  } catch {
  }
}

export function useUser(initialUser = null) {
  // const checkAuthCookies = useUserStore((state) => state.checkAuthCookies);

  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      emitClient("useUser_queryFn_enter", { initialUser_present: Boolean(initialUser) });
      try {
        const res = await axios.get("/api/auth/getUser");
        emitClient("useUser_queryFn_success", {
          status: res.status,
          has_user: Boolean(res.data),
        });
        return res.data;
      } catch (err) {
        emitClient("useUser_queryFn_error", {
          status: err?.response?.status,
          message: err?.message,
        });
        throw err;
      }
    },
    initialData: initialUser,
    enabled: !initialUser,
    refetchOnMount: initialUser ? false : true,
    retry: 4,
  });
}
