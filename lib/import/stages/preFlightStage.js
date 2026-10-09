import { sha256 } from "../shared/hash";
import { getFileBuffer } from "../shared/file";
import { resolvePlugin, listPlugins } from "../registry/pluginRegistry";
import { isAlreadyImported } from "../../repository/questionService";

export async function preFlightStage(ctx) {
  if (ctx.fileMetadata?.extension?.toLowerCase() === ".pdf") {
    return {
      success: false,
      fatal: true,
      errors: [{
        code: "PDF_IMPORT_NOT_SUPPORTED",
        message: "PDF import has been removed. Please use DOCX or JSON.",
        stage: "preFlight",
        file: {
          name: ctx.fileMetadata.name,
          extension: ctx.fileMetadata.extension,
          mime: ctx.fileMetadata.mime,
        },
      }],
    };
  }

  ctx.plugin = resolvePlugin(ctx.file);
  if (!ctx.plugin) {
    return {
      success: false,
      fatal: true,
      errors: [{
        code: "NO_PLUGIN",
        message: "No importer supports this file",
        stage: "preFlight",
        file: {
          name: ctx.fileMetadata.name,
          extension: ctx.fileMetadata.extension,
          mime: ctx.fileMetadata.mime,
        },
        availablePlugins: listPlugins().map((p) => ({
          id: p.id,
          implemented: p.implemented,
          extensions: p.extensions,
        })),
      }],
    };
  }

  ctx.buffer = await getFileBuffer(ctx.file);
  ctx.importSourceId = sha256(ctx.buffer);

  const already = await isAlreadyImported(ctx.plugin.id, ctx.importSourceId);
  if (already) {
    ctx.stats.skipped = 1;
    return { success: true, skipped: true, reason: "already_imported" };
  }

  return { success: true };
}
