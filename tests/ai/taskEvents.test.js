import { describe, it, expect, vi } from "vitest";
import { createTaskEmitter, NULL_EMITTER, emitTaskEvent, TaskEvent } from "../../lib/ai/engine/taskEvents";

describe("taskEvents", () => {
  it("emitter receives events", () => {
    const emitter = createTaskEmitter();
    const events = [];
    emitter.on(TaskEvent.TASK_STARTED, (e) => events.push(e));
    emitter.on(TaskEvent.STAGE_FINISHED, (e) => events.push(e));

    emitTaskEvent(emitter, TaskEvent.TASK_STARTED, { taskId: "t1" });
    emitTaskEvent(emitter, TaskEvent.STAGE_FINISHED, { taskId: "t1", stage: "x", durationMs: 5 });

    expect(events).toHaveLength(2);
    expect(events[0].taskId).toBe("t1");
    expect(events[1].stage).toBe("x");
  });

  it("NULL_EMITTER is a no-op", () => {
    expect(NULL_EMITTER.emit("x")).toBe(false);
    expect(NULL_EMITTER.listenerCount()).toBe(0);
  });

  it("emitTaskEvent on null/undefined emitter is a no-op", () => {
    expect(() => emitTaskEvent(null, "x", {})).not.toThrow();
  });

  it("emits artifact events with id/parentId", () => {
    const emitter = createTaskEmitter();
    const artifacts = [];
    emitter.on(TaskEvent.ARTIFACT, (a) => artifacts.push(a));
    emitTaskEvent(emitter, TaskEvent.ARTIFACT, { id: "art1", parentId: null, type: "structured-context", version: "1", taskId: "t1" });
    expect(artifacts[0].id).toBe("art1");
    expect(artifacts[0].parentId).toBeNull();
  });
});