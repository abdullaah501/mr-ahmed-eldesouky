import { getExecutor } from "../executors/registry";
import { getWorkflow } from "./workflowRegistry";
import { AiError, AiErrorCode } from "../types/errors";

const PRIMITIVE_TYPES = new Set(["text", "object", "stream", "vision", "extraction"]);

export function isPrimitiveTask(type) {
  return PRIMITIVE_TYPES.has(type);
}

export function resolveHandler(type) {
  if (isPrimitiveTask(type)) {
    return { kind: "executor", executor: getExecutor(type) };
  }
  const workflow = getWorkflow(type);
  if (workflow) {
    return { kind: "workflow", workflow };
  }
  return { kind: "unknown" };
}