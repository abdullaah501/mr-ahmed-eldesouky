import { NULL_EMITTER, emitTaskEvent, TaskEvent } from "./taskEvents";

export class WorkflowEngine {
  constructor(stages = [], { emitter } = {}) {
    this.stages = stages;
    this.emitter = emitter || NULL_EMITTER;
  }

  async run(ctx) {
    const startedAt = Date.now();
    ctx.events = ctx.events || [];
    ctx.timings = ctx.timings || [];
    ctx.error    = ctx.error    ?? null;
    ctx.warnings = ctx.warnings || [];
    ctx.errors   = ctx.errors   || [];
    ctx.output   = ctx.output   ?? null;

    emitTaskEvent(this.emitter, TaskEvent.TASK_STARTED, { taskId: ctx.taskId, workflow: ctx.workflow, feature: ctx.feature });

    for (const stage of this.stages) {
      const name = stage.name || "stage";
      const t0 = process.hrtime.bigint();
      ctx.events.push({ stage: name, status: "started", timestamp: Date.now() });
      emitTaskEvent(this.emitter, TaskEvent.STAGE_STARTED, { taskId: ctx.taskId, stage: name });

      let result;
      try {
        result = await stage.run(ctx);
      } catch (err) {
        result = { fatal: true, errors: [{ stage: name, message: err?.message || String(err) }] };
      }

      const durationMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
      ctx.timings.push({ stage: name, durationMs });
      emitTaskEvent(this.emitter, TaskEvent.STAGE_FINISHED, { taskId: ctx.taskId, stage: name, durationMs });

      if (result && result.errors && result.errors.length) {
        ctx.errors.push(...result.errors);
      }
      if (result && result.warnings && result.warnings.length) {
        ctx.warnings.push(...result.warnings);
      }

      if (result && result.artifact) {
        emitTaskEvent(this.emitter, TaskEvent.ARTIFACT, {
          taskId: ctx.taskId,
          id: result.artifact.id,
          parentId: result.artifact.parentId,
          type: result.artifact.type,
          version: result.artifact.version,
        });
      }

      if (result && result.skipped) {
        ctx.events.push({ stage: name, status: "completed", skipped: true, timestamp: Date.now() });
        return finalize(ctx, this.emitter);
      }
      if (result && (result.fatal || result.success === false)) {
        ctx.events.push({ stage: name, status: "failed", timestamp: Date.now() });
        return finalize(ctx, this.emitter);
      }

      ctx.events.push({ stage: name, status: "completed", timestamp: Date.now() });
    }

    return finalize(ctx, this.emitter);
  }
}

function finalize(ctx, emitter) {
  const totalMs = Date.now() - (ctx.events[0]?.timestamp || Date.now());
  ctx.totalDurationMs = totalMs;
  ctx.status = ctx.errors.length === 0 ? "ok" : "failed";
  emitTaskEvent(emitter, TaskEvent[ctx.status === "ok" ? "TASK_COMPLETED" : "TASK_FAILED"], { taskId: ctx.taskId, status: ctx.status, totalDurationMs: totalMs });
  return ctx;
}