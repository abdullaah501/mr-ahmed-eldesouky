import { DEFAULT_MAX_FILE_SIZE } from "../shared/file";

export async function readStage(ctx) {
  if (!ctx.buffer || ctx.buffer.length === 0) {
    return {
      success: false,
      fatal: true,
      errors: [{ code: "EMPTY_FILE", message: "The file is empty", stage: "read" }],
    };
  }

  const maxSize = ctx.options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
  if (ctx.buffer.length > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return {
      success: false,
      fatal: true,
      errors: [{ code: "FILE_TOO_LARGE", message: `File is too large (maximum ${maxMB}MB)`, stage: "read" }],
    };
  }

  return { success: true };
}
