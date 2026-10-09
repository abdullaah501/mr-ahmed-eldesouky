import { preFlightStage } from "../stages/preFlightStage";
import { readStage } from "../stages/readStage";
import { parseStage } from "../stages/parseStage";
import { normalizeStage } from "../stages/normalizeStage";
import { validateStage } from "../stages/validateStage";
import { mapStage } from "../stages/mapStage";
import { persistStage } from "../stages/persistStage";
import { getFileName, getFileSize, getFileExtension, getFileMimeType } from "../shared/file";

function newRunId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const stages = [
  preFlightStage,
  readStage,
  parseStage,
  normalizeStage,
  validateStage,
  mapStage,
  persistStage,
];

function createImportContext({ file, userId, options = {} }) {
  return {
    importRunId: newRunId(),
    file,
    userId,
    options,
    plugin: null,
    buffer: null,
    importSourceId: null,
    fileMetadata: {
      name: getFileName(file),
      size: getFileSize(file),
      mime: getFileMimeType(file),
      extension: getFileExtension(file),
    },
    rawQuestions: null,
    rawMetadata: {},
    metadata: {},
    validQuestions: [],
    mappedItems: [],
    stats: {
      parsed: 0,
      normalized: 0,
      validated: 0,
      mapped: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    },
    timings: {},
    events: [],
    errors: [],
    warnings: [],
  };
}

function emitEvent(ctx, stage, status, meta) {
  ctx.events.push({ stage, status, timestamp: Date.now(), ...(meta || {}) });
}

export async function run({ file, userId, options }) {
  const ctx = createImportContext({ file, userId, options });
  const pipelineStart = Date.now();

  for (const stage of stages) {
    if (ctx.options.dryRun && stage.name === "persistStage") {
      emitEvent(ctx, stage.name, "skipped", { reason: "dryRun" });
      continue;
    }

    const t0 = process.hrtime.bigint();
    emitEvent(ctx, stage.name, "started");

    const result = await stage(ctx);

    const durationMs = Math.round(Number(process.hrtime.bigint() - t0) / 1e6);
    ctx.timings[stage.name] = (ctx.timings[stage.name] || 0) + durationMs;

    if (result) {
      if (result.errors && result.errors.length > 0) {
        ctx.errors.push(...result.errors);
      }
      if (result.warnings && result.warnings.length > 0) {
        ctx.warnings.push(...result.warnings);
      }

      if (result.skipped) {
        ctx.stats.skipped = 1;
        emitEvent(ctx, stage.name, "completed", { skipped: true, reason: result.reason });
        const totalDuration = Date.now() - pipelineStart;
        return {
          success: true,
          report: {
            importRunId: ctx.importRunId,
            imported: 0,
            failed: 0,
            skipped: 1,
            warnings: ctx.warnings.length,
            duration: totalDuration,
            plugin: ctx.plugin?.id,
            importSourceId: ctx.importSourceId,
            skipReason: result.reason || "already_imported",
            file: ctx.fileMetadata,
          },
          errors: [],
          warnings: ctx.warnings,
          timings: ctx.timings,
        };
      }

      if (result.fatal || (result.success === false && !result.skipped)) {
        emitEvent(ctx, stage.name, "failed", { errors: result.errors });
        break;
      }

      emitEvent(ctx, stage.name, "completed");
    } else {
      emitEvent(ctx, stage.name, "completed");
    }
  }

  const totalDuration = Date.now() - pipelineStart;
  emitEvent(ctx, "pipeline", "completed", { duration: totalDuration });

  return {
    success: ctx.errors.length === 0,
    report: {
      importRunId: ctx.importRunId,
      parsed: ctx.stats.parsed,
      normalized: ctx.stats.normalized,
      validated: ctx.stats.validated,
      mapped: ctx.stats.mapped,
      imported: ctx.stats.inserted,
      failed: ctx.stats.failed,
      skipped: ctx.stats.skipped,
      warnings: ctx.warnings.length,
      duration: totalDuration,
      plugin: ctx.plugin?.id,
      importSourceId: ctx.importSourceId,
      file: ctx.fileMetadata,
    },
    errors: ctx.errors,
    warnings: ctx.warnings,
    timings: ctx.timings,
  };
}
