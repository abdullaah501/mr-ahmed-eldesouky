// Trace module index. Re-exports the public surface of lib/trace/*
// for convenient single-import usage in instrumented files.

export { getTraceContext, runWithContext, setContextFields, newReqId, getStorage } from "./context.js";
export { emit, emitRefresh, emitCheckUser, emitHttp, emitCookie, emitMongoStart, emitMongoEnd } from "./emit.js";
export {
  getInvocationId,
  hashToken,
  hashValue,
  tsHr,
  nowIso,
  captureStack,
  mongoTime,
} from "./helpers.js";
export {
  withCaller,
  withTracePhase,
  withReqId,
  withCallerSync,
  captureCallerStack,
} from "./caller-id.js";
export { withHttpTrace, withHttpTraceSync } from "./http-trace.js";
