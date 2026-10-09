import { runWithContext } from "./context.js";
import { emit } from "./emit.js";
import { nowIso, captureStack } from "./helpers.js";

export async function withCaller(callerName, fn) {
  return runWithContext({ caller: callerName }, async () => {
    if (typeof fn === "function") {
      return await fn();
    }
    return fn;
  });
}

export async function withTracePhase(phase, fn) {
  return runWithContext({ phase }, async () => {
    if (typeof fn === "function") {
      return await fn();
    }
    return fn;
  });
}

export async function withReqId(reqId, fn) {
  return runWithContext({ req_id: reqId }, async () => {
    if (typeof fn === "function") {
      return await fn();
    }
    return fn;
  });
}

export function withCallerSync(callerName, fn) {
  return runWithContext({ caller: callerName }, fn);
}

export function captureCallerStack(maxFrames = 5) {
  return captureStack(maxFrames);
}

export { emit, nowIso };
