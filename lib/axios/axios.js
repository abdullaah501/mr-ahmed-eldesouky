import axios from "axios";
import { invalidateAuth } from "../auth/clientSync";

function genId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
  }
  return "req-" + Math.random().toString(36).slice(2) + "-" + Date.now();
}

function emitClient(event, fields) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ts_hr: (typeof performance !== "undefined" ? performance.now() * 1e6 : Date.now() * 1e6).toString(),
      event: "client_" + event,
      source: "axios",
      fields: fields || {},
    });
    if (typeof console !== "undefined") console.log(line);
  } catch {
  }
}

 const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_URL || "",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && window.__trace_client_id) {
    config.headers = config.headers || {};
    if (!config.headers["x-client-id"]) {
      config.headers["x-client-id"] = window.__trace_client_id;
    }
  }
  return config;
});

const refreshAxios = axios.create({
  baseURL: process.env.NEXT_PUBLIC_URL || "",
  withCredentials: true,
});

refreshAxios.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && window.__trace_client_id) {
    config.headers = config.headers || {};
    if (!config.headers["x-client-id"]) {
      config.headers["x-client-id"] = window.__trace_client_id;
    }
  }
  return config;
});

// Single-flight refresh coordinator (Phase 2):
//   When N requests 401 simultaneously, exactly ONE /api/auth/refresh call is
//   made per tab; every 401 awaits the same in-flight promise and retries after
//   it settles. Without this, N concurrent refreshes collide on the session CAS
//   and (pre-grace-window) revoked the session — the "logged out before 7 days"
//   bug. The promise is cleared in .finally() so a later 401 (after the refresh
//   completed) starts a fresh refresh.
let inflightRefresh = null;

function startSingleFlightRefresh(headers) {
  if (!inflightRefresh) {
    inflightRefresh = refreshAxios
      .get("/api/auth/refresh", { headers })
      .catch((error) => {
        // Every request awaiting this shared promise observes the same
        // rejection. Invalidate once here, rather than once per 401 caller.
        invalidateAuth();
        throw error;
      })
      .finally(() => {
        inflightRefresh = null;
      });
  }
  return inflightRefresh;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const origReqId =
      (original && original.headers && (original.headers["x-request-id"] || original.headers["X-Request-Id"])) ||
      null;
    const origClientId =
      (original && original.headers && (original.headers["x-client-id"] || original.headers["X-Client-Id"])) ||
      null;
    const newReqId = genId();

    emitClient("axios_interceptor_enter", {
      original_url: original?.url,
      original_method: original?.method,
      original_status: error.response?.status,
      original_retried: Boolean(original?._retry),
      original_req_id: origReqId,
      new_req_id: newReqId,
    });

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        emitClient("axios_interceptor_refresh_start", {
          new_req_id: newReqId,
          parent_req_id: origReqId,
          client_id: origClientId,
          original_url: original?.url,
        });
        const refreshHeaders = {
          "x-request-id": newReqId,
        };
        if (origReqId) refreshHeaders["x-original-req-id"] = origReqId;
        if (origClientId) refreshHeaders["x-client-id"] = origClientId;
        await startSingleFlightRefresh(refreshHeaders);
        const t1 = (typeof performance !== "undefined" ? performance.now() : Date.now());
        emitClient("axios_interceptor_refresh_end", {
          new_req_id: newReqId,
          duration_ms: t1 - t0,
        });
        const retriedHeaders = { ...(original.headers || {}) };
        if (origClientId && !retriedHeaders["x-client-id"]) retriedHeaders["x-client-id"] = origClientId;
        original.headers = retriedHeaders;
        return api(original);
      } catch (err) {
        emitClient("axios_interceptor_refresh_failed", {
          new_req_id: newReqId,
          error_message: err?.message,
        });
        console.log(err);
      }
    }

    return Promise.reject(error);
  }
);

export { api, refreshAxios };
