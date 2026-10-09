import { getTraceContext } from "./context.js";
import { nowIso, tsHr } from "./helpers.js";

function safeWrite(line) {
  try {
    process.stdout.write(line + "\n");
  } catch {
  }
}

export function emit(event, extra = {}) {
  const ctx = getTraceContext();
  const payload = {
    ts: nowIso(),
    ts_hr: tsHr(),
    req_id: ctx.req_id || "orphan",
    parent_req_id: ctx.parent_req_id || null,
    client_id: ctx.client_id || null,
    invocation_id: ctx.invocation_id || null,
    event,
    phase: ctx.phase || "unknown",
    caller: ctx.caller || "unknown",
    session_id: ctx.session_id || null,
    user_id: ctx.user_id || null,
    fields: extra || {},
  };
  try {
    safeWrite(JSON.stringify(payload));
  } catch {
  }
}

export function emitRefresh(event, extra = {}) {
  emit(event, extra);
}

export function emitCheckUser(event, extra = {}) {
  emit(event, extra);
}

export function emitHttp(event, extra = {}) {
  emit(event, extra);
}

export function emitCookie(event, extra = {}) {
  emit(event, extra);
}

export function emitMongoStart(op, extra = {}) {
  emit(`mongo_${op}_start`, { op, ...extra });
}

export function emitMongoEnd(op, extra = {}) {
  const { duration_ms, result, error_message } = extra;
  const fields = { op, duration_ms };
  if (error_message) fields.error_message = error_message;
  if (result !== undefined) {
    if (result && typeof result === "object") {
      if ("matchedCount" in result) fields.matched_count = result.matchedCount;
      if ("modifiedCount" in result) fields.modified_count = result.modifiedCount;
      if ("deletedCount" in result) fields.deleted_count = result.deletedCount;
      if ("upsertedCount" in result) fields.upserted_count = result.upsertedCount;
    }
  }
  emit(`mongo_${op}_end`, fields);
}
