import { createHash } from "node:crypto";
import { getTraceContext } from "./context.js";
import { emitMongoEnd } from "./emit.js";

let invocationCounter = 0;

export function getInvocationId() {
  invocationCounter += 1;
  return invocationCounter;
}

export function hashToken(token) {
  if (token == null) return null;
  if (typeof token !== "string") return null;
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export function hashValue(value) {
  if (value == null) return null;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export function tsHr() {
  return process.hrtime.bigint().toString();
}

export function nowIso() {
  return new Date().toISOString();
}

export function captureStack(maxFrames = 5) {
  try {
    const orig = Error.prepareStackTrace;
    Error.prepareStackTrace = (_err, stack) => stack;
    const err = {};
    Error.captureStackTrace(err, captureStack);
    const frames = err.stack || [];
    Error.prepareStackTrace = orig;
    return frames
      .filter((f) => {
        const file = f.getFileName() || "";
        return (
          !file.includes("node_modules") &&
          !file.includes("next/dist") &&
          !file.includes("internal/") &&
          !file.includes("lib/trace/")
        );
      })
      .slice(0, maxFrames)
      .map((f) => ({
        file: f.getFileName(),
        line: f.getLineNumber(),
        column: f.getColumnNumber(),
        function: f.getFunctionName(),
      }));
  } catch {
    return [];
  }
}

export async function mongoTime(op, fn) {
  const start = process.hrtime.bigint();
  let err = null;
  let result = null;
  try {
    result = await fn();
    return result;
  } catch (e) {
    err = e;
    throw e;
  } finally {
    const duration_ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (err) {
      emitMongoEnd(op, { duration_ms, error_message: err.message });
    } else {
      emitMongoEnd(op, { duration_ms, result });
    }
  }
}
