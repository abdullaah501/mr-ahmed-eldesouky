import { EventEmitter } from "events";

export function createTaskEmitter() {
  return new EventEmitter();
}

export const NULL_EMITTER = {
  emit() {
    return false;
  },
  on() {
    return this;
  },
  once() {
    return this;
  },
  off() {
    return this;
  },
  removeListener() {
    return this;
  },
  listenerCount() {
    return 0;
  },
};

export function emitTaskEvent(emitter, event, payload) {
  if (!emitter || typeof emitter.emit !== "function") return;
  try {
    emitter.emit(event, payload);
  } catch {
  }
}

export const TaskEvent = {
  TASK_STARTED: "task.started",
  STAGE_STARTED: "stage.started",
  STAGE_FINISHED: "stage.finished",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  TASK_RETRY: "task.retry",
  TASK_FALLBACK: "task.fallback",
  ARTIFACT: "artifact",
};