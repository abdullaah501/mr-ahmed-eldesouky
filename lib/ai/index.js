import "./providers";
import "./prompts";
import "./schemas";
import "./workflows";
import "./outputTargets";

import { runTask } from "./executors/taskRunner";
import { getWorkflow } from "./engine/workflowRegistry";
import { AiError, AiErrorCode } from "./types/errors";
import { isPrimitiveTask } from "./engine/taskRegistry";
import { isEnabled } from "./config/env";

export async function ai(task) {
  if (!task || !task.type) {
    throw new AiError(AiErrorCode.INVALID_TASK, "task.type is required");
  }
  if (!isEnabled()) {
    throw new AiError(AiErrorCode.PLATFORM_DISABLED, "AI platform is disabled (AI_ENABLED=false)");
  }

  if (isPrimitiveTask(task.type)) {
    return runTask(task);
  }

  const workflow = getWorkflow(task.type);
  if (!workflow) {
    throw new AiError(AiErrorCode.UNKNOWN_WORKFLOW, `Unknown workflow/task type: "${task.type}"`);
  }
  return workflow.run(task);
}

export { runTask } from "./executors/taskRunner";
export { AiError, AiErrorCode, isRetryableError } from "./types/errors";

export const AI_VERSION = "0.1.0";

const aiPlatform = { ai, runTask, AI_VERSION };
export default aiPlatform;