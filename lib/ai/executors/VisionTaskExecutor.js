import { CAPABILITY } from "../types/capabilities";
import { AiError, AiErrorCode } from "../types/errors";

export async function VisionTaskExecutor(adapter, task) {
  if (!adapter.supports(CAPABILITY.VISION)) {
    throw new AiError(
      AiErrorCode.CAPABILITY_MISSING,
      `Provider ${adapter.id} does not support vision`,
      { provider: adapter.id, capability: CAPABILITY.VISION }
    );
  }
  const { messages, annotations, options, files, model } = task;
  return adapter.generateText({ messages, options, files, model, annotations });
}