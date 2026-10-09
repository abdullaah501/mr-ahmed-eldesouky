import { runWithContext, newReqId } from "./context.js";
import { emit, emitHttp, emitCookie } from "./emit.js";
import { nowIso, hashToken } from "./helpers.js";
import { randomUUID } from "node:crypto";

function readClientId(req) {
  try {
    const h = req?.headers?.get?.("x-client-id");
    if (h) return h;
  } catch {
  }
  return null;
}

function readExistingReqId(req) {
  try {
    const h = req?.headers?.get?.("x-request-id");
    if (h) return h;
  } catch {
  }
  return null;
}

function readParentReqId(req) {
  try {
    const h = req?.headers?.get?.("x-original-req-id");
    if (h) return h;
  } catch {
  }
  return null;
}

function detectPrefetch(req) {
  try {
    const h = req?.headers?.get?.("next-router-prefetch");
    if (h === "1") return true;
    const url = req?.url || "";
    if (url.includes("?_rsc=") || url.includes("&_rsc=")) return true;
  } catch {
  }
  return false;
}

function safeCookieHash(req, name) {
  try {
    const c = req?.cookies?.get?.(name)?.value;
    return c ? hashToken(c) : null;
  } catch {
    return null;
  }
}

function safeCookiePresent(req, name) {
  try {
    return Boolean(req?.cookies?.get?.(name)?.value);
  } catch {
    return false;
  }
}

function captureRequestSnapshot(req) {
  const isPrefetch = detectPrefetch(req);
  const snapshot = {
    method: req?.method || "GET",
    url: req?.url || "",
    pathname: (() => {
      try {
        return new URL(req?.url || "", "http://localhost").pathname;
      } catch {
        return req?.url || "";
      }
    })(),
    headers_safe: {
      "user-agent": safeHeader(req, "user-agent"),
      referer: safeHeader(req, "referer"),
      origin: safeHeader(req, "origin"),
      "x-forwarded-for": safeHeader(req, "x-forwarded-for"),
      "x-real-ip": safeHeader(req, "x-real-ip"),
      "next-router-prefetch": safeHeader(req, "next-router-prefetch"),
      "x-client-id": safeHeader(req, "x-client-id"),
      "x-request-id": safeHeader(req, "x-request-id"),
    },
    cookies_present: {
      access_token: safeCookiePresent(req, "access_token"),
      s_i: safeCookiePresent(req, "s-i"),
    },
    cookies_hash: {
      access_token_hash: safeCookieHash(req, "access_token"),
      s_i_hash: safeCookieHash(req, "s-i"),
    },
    is_prefetch: isPrefetch,
  };
  return snapshot;
}

function safeHeader(req, name) {
  try {
    return req?.headers?.get?.(name) || null;
  } catch {
    return null;
  }
}

function captureResponseSetCookie(response) {
  try {
    const cookies = response?.headers?.getSetCookie?.() || [];
    const out = {};
    const hash = {};
    const maxAge = {};
    for (const c of cookies) {
      const [pair] = c.split(";");
      const [name, value] = pair.split("=");
      out[name] = true;
      hash[name] = hashToken(value);
      const m = c.match(/Max-Age=(\d+)/i);
      if (m) maxAge[name] = parseInt(m[1], 10);
    }
    return { set_cookie: out, set_cookie_hash: hash, set_cookie_max_age: maxAge };
  } catch {
    return { set_cookie: {}, set_cookie_hash: {}, set_cookie_max_age: {} };
  }
}

export async function withHttpTrace(req, routeKind, handler) {
  const start = process.hrtime.bigint();
  const reqId = readExistingReqId(req) || newReqId();
  const parentReqId = readParentReqId(req);
  const clientId = readClientId(req);
  const phase = detectPrefetch(req) ? "rsc_prefetch" : "rsc_render_or_api";

  const snapshot = captureRequestSnapshot(req);
  emitHttp("http_request_enter", {
    route_kind: routeKind,
    ...snapshot,
  });

  let response;
  let status = 0;
  let resultErr = null;
  try {
    response = await runWithContext(
      {
        req_id: reqId,
        parent_req_id: parentReqId,
        client_id: clientId,
        phase,
        trace_started_at: nowIso(),
      },
      () => handler()
    );
    status = response?.status || 0;
    return response;
  } catch (err) {
    resultErr = err;
    status = 500;
    throw err;
  } finally {
    const duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
    const cookieInfo = response ? captureResponseSetCookie(response) : { set_cookie: {}, set_cookie_hash: {}, set_cookie_max_age: {} };
    emitHttp("http_request_exit", {
      route_kind: routeKind,
      status,
      response_duration_ms: duration_ms,
      ...cookieInfo,
      error_message: resultErr ? resultErr.message : null,
    });
    // Do not modify response headers. The x-request-id is emitted via the
    // trace log and propagated via the AsyncLocalStorage context. Setting it
    // on the response would change behavior observed by tests.
  }
}

export function withHttpTraceSync(req, routeKind, handler) {
  const start = process.hrtime.bigint();
  const reqId = readExistingReqId(req) || newReqId();
  const parentReqId = readParentReqId(req);
  const clientId = readClientId(req);
  const phase = detectPrefetch(req) ? "rsc_prefetch" : "rsc_render_or_api";

  const snapshot = captureRequestSnapshot(req);
  emitHttp("http_request_enter", {
    route_kind: routeKind,
    ...snapshot,
  });

  let response;
  let status = 0;
  let resultErr = null;
  try {
    response = runWithContext(
      {
        req_id: reqId,
        parent_req_id: parentReqId,
        client_id: clientId,
        phase,
        trace_started_at: nowIso(),
      },
      () => handler()
    );
    status = response?.status || 0;
    return response;
  } catch (err) {
    resultErr = err;
    status = 500;
    throw err;
  } finally {
    const duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
    const cookieInfo = response ? captureResponseSetCookie(response) : { set_cookie: {}, set_cookie_hash: {}, set_cookie_max_age: {} };
    emitHttp("http_request_exit", {
      route_kind: routeKind,
      status,
      response_duration_ms: duration_ms,
      ...cookieInfo,
      error_message: resultErr ? resultErr.message : null,
    });
    // Do not modify response headers. See note above.
  }
}
