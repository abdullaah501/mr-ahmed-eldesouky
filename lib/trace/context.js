import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage();

export function getTraceContext() {
  return (
    storage.getStore() || {
      req_id: "orphan",
      parent_req_id: null,
      client_id: null,
      caller: "unknown",
      phase: "unknown",
      trace_started_at: new Date().toISOString(),
    }
  );
}

export function runWithContext(ctx, fn) {
  const prev = storage.getStore() || {};
  const next = { ...prev, ...ctx };
  return storage.run(next, fn);
}

export function setContextFields(extra) {
  const prev = storage.getStore();
  if (!prev) return;
  Object.assign(prev, extra);
}

export function newReqId() {
  return randomUUID();
}

export function getStorage() {
  return storage;
}
