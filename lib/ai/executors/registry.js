import { TextTaskExecutor } from "./TextTaskExecutor";
import { ObjectTaskExecutor } from "./ObjectTaskExecutor";
import { ExtractionTaskExecutor } from "./ExtractionTaskExecutor";
import { StreamTaskExecutor } from "./StreamTaskExecutor";
import { VisionTaskExecutor } from "./VisionTaskExecutor";

const executors = new Map();

export function registerExecutor(type, fn) {
  if (!type || typeof fn !== "function") {
    throw new Error("registerExecutor requires type and executor function");
  }
  executors.set(type, fn);
}

export function getExecutor(type) {
  return executors.get(type) || null;
}

export function listExecutors() {
  return [...executors.keys()];
}

export function clearExecutors() {
  executors.clear();
}

registerExecutor("text", TextTaskExecutor);
registerExecutor("object", ObjectTaskExecutor);
registerExecutor("extraction", ExtractionTaskExecutor);
registerExecutor("stream", StreamTaskExecutor);
registerExecutor("vision", VisionTaskExecutor);