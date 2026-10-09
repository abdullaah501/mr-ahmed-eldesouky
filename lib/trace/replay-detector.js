// Replay detector post-processor.
// Consumes the JSON log stream (process.stdout) and emits Replay Reports
// when a REFRESH_REPLAY_DETECTED or a refresh_auth_replay event is observed
// within 5 seconds of a previous successful refreshAuth on the same session_id.
//
// Run separately: `node lib/trace/replay-detector.js`
// Not in the request path.

import { createInterface } from "node:readline";
import { createHash } from "node:crypto";

const WINDOW_MS = 5000;
const recentBySession = new Map();

function now() {
  return Date.now();
}

function hashToken(t) {
  if (t == null) return null;
  if (typeof t !== "string") return null;
  return createHash("sha256").update(t).digest("hex").slice(0, 16);
}

function recordEvent(ev) {
  const sessionId = ev.session_id;
  if (!sessionId) return;
  const list = recentBySession.get(sessionId) || [];
  list.push(ev);
  while (list.length && now() - list[0].ts > WINDOW_MS) list.shift();
  recentBySession.set(sessionId, list);
}

function findRecentSuccess(sessionId) {
  const list = recentBySession.get(sessionId) || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].event === "refresh_auth_success") return list[i];
  }
  return null;
}

function buildReport(success, replay) {
  const report = {
    report_id: crypto.randomUUID(),
    report_type: "REFRESH_REPLAY",
    session_id: success.session_id,
    replay_detected_at: new Date().toISOString(),
    refresh_a: pick(success),
    refresh_b: pick(replay),
    timeline: buildTimeline(success, replay),
    overlap_analysis: {
      refresh_a_to_refresh_b_overlap_ms:
        new Date(replay.ts).getTime() - new Date(success.ts).getTime(),
      shared_session: true,
      shared_session_id: success.session_id,
      shared_cookies: true,
      shared_refresh_token_hash_at_observation:
        success.fields?.session_refresh_token_hash || null,
      conclusion:
        success.req_id === replay.req_id
          ? "SAME_REQUEST"
          : "CONCURRENT_REQUESTS",
      confidence: "HIGH",
    },
    conclusion:
      success.caller !== replay.caller
        ? `Refresh A originated from ${success.caller} (${success.phase}). ` +
          `Refresh B originated from ${replay.caller} (${replay.phase}). ` +
          `Both ran on the same session. CAS mismatch in refresh B indicates ` +
          `that refresh A had already rotated the session.refreshToken before ` +
          `refresh B's findOneAndUpdate filter was evaluated.`
        : `Both refreshes originated from ${success.caller}. ` +
          `This is unusual and suggests a single caller fired two concurrent ` +
          `refreshes (e.g., React StrictMode double-invocation, parallel SSR ` +
          `render).`,
  };
  return report;
}

function pick(ev) {
  return {
    req_id: ev.req_id,
    parent_req_id: ev.parent_req_id,
    client_id: ev.client_id,
    invocation_id: ev.invocation_id,
    caller: ev.caller,
    caller_detail: ev.caller,
    phase: ev.phase,
    url: null,
    method: null,
    ts_in: ev.fields?.ts_in || ev.ts,
    ts_out: ev.ts,
    duration_ms: ev.fields?.duration_ms || null,
    session_found: ev.fields?.session_found,
    session_isExp_before: ev.fields?.session_isExp_before,
    session_expiredAt_before: ev.fields?.session_expiredAt_before,
    session_refresh_token_hash_before:
      ev.fields?.session_refresh_token_hash || ev.fields?.cas_filter_refresh_token_hash,
    jwt_verify_ok: ev.fields?.jwt_verify_ok,
    decoded_userId: ev.fields?.decoded_userId,
    user_found: ev.fields?.user_found,
    db_tokenVersion: ev.fields?.db_tokenVersion,
    jwt_tokenVersion: ev.fields?.jwt_tokenVersion,
    cas_attempted: ev.fields?.cas_attempted,
    cas_matched: ev.fields?.cas_matched,
    cas_filter_refresh_token_hash: ev.fields?.cas_filter_refresh_token_hash,
    cas_new_refresh_token_hash: ev.fields?.cas_new_refresh_token_hash,
    new_access_token_hash: ev.fields?.new_access_token_hash,
    new_refresh_token_hash: ev.fields?.new_refresh_token_hash,
    set_cookie_emitted: ev.fields?.set_cookie_emitted,
    set_cookie_access_token_hash: ev.fields?.set_cookie_access_token_hash,
    set_cookie_access_token_max_age: ev.fields?.set_cookie_access_token_max_age,
    result: ev.fields?.result || (ev.event === "refresh_auth_success" ? "SUCCESS" : "REPLAY_DETECTED"),
  };
}

function buildTimeline(success, replay) {
  return [
    { ts: success.ts, event: "refresh_a_enter", req_id: success.req_id },
    {
      ts: success.ts,
      event: "refresh_a_session_findone_end",
      session_refresh_token_hash: success.fields?.session_refresh_token_hash,
    },
    {
      ts: success.ts,
      event: "refresh_a_cas_end",
      cas_matched: true,
    },
    { ts: success.ts, event: "refresh_a_exit_success" },
    { ts: replay.ts, event: "refresh_b_enter", req_id: replay.req_id },
    {
      ts: replay.ts,
      event: "refresh_b_session_findone_end",
      session_refresh_token_hash: replay.fields?.session_refresh_token_hash,
    },
    {
      ts: replay.ts,
      event: "refresh_b_cas_end",
      cas_matched: false,
    },
    { ts: replay.ts, event: "refresh_b_set_isexp_end" },
  ];
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  if (!ev || !ev.event) return;
  if (ev.event === "refresh_auth_success" || ev.event === "refresh_auth_replay") {
    recordEvent({ ...ev, ts: ev.ts || new Date().toISOString() });
  }
  if (ev.event === "refresh_auth_replay") {
    const sessionId = ev.session_id;
    const recent = findRecentSuccess(sessionId);
    if (recent) {
      const report = buildReport(recent, ev);
      process.stdout.write(JSON.stringify(report) + "\n");
    }
  }
});
