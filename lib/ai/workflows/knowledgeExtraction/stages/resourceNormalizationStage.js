import crypto from "crypto";
import { getProvider } from "../../../providers/registry";
import { CAPABILITY } from "../../../types/capabilities";

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function getInputBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input?.buffer && Buffer.isBuffer(input.buffer)) return input.buffer;
  if (typeof input?.arrayBuffer === "function") return Buffer.from(await input.arrayBuffer());
  return null;
}

function isPdf(input) {
  const name = String(input?.name || input?.filename || "").toLowerCase();
  const type = String(input?.type || input?.mimeType || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

function isImage(input) {
  const name = String(input?.name || input?.filename || "").toLowerCase();
  const type = String(input?.type || input?.mimeType || "").toLowerCase();
  return type.startsWith("image/") || [".png", ".jpg", ".jpeg"].some((ext) => name.endsWith(ext));
}

// Named applyNativeFile (not use*) so react-hooks/rules-of-hooks does not
// mistake this plain helper for a React hook.
async function applyNativeFile(ctx, input) {
  const buffer = await getInputBuffer(input);
  if (!buffer) throw new Error("Failed to read the provided file");
  ctx.useNativeFile = true;
  ctx.nativeFileRef = { buffer, mimeType: input?.type || input?.mimeType || "application/octet-stream" };
  ctx.normalizedInput = null;
  ctx.resolvedInputType = "native-file";
  // Content-addressed cache identity for native files: without a file hash
  // the extraction cache key would have no input component, so the cache was
  // previously skipped entirely (ctx.skipCache = true) for this path.
  ctx.fileHash = sha256Hex(buffer);
  return { success: true };
}

const stage = {
  name: "resource-normalization",
  async run(ctx) {
    const input = ctx.input;

    if (ctx.useNativeFile && ctx.nativeFileRef) {
      ctx.normalizedInput = null;
      ctx.resolvedInputType = "native-file";
      if (!ctx.fileHash && Buffer.isBuffer(ctx.nativeFileRef.buffer)) {
        ctx.fileHash = sha256Hex(ctx.nativeFileRef.buffer);
      }
      return { success: true };
    }

    try {
      if (isPdf(input)) {
        const { listByCategory } = await import("../../../resources");
        const pdfExtractor = listByCategory("documents").find((extractor) => extractor.id === "pdf");
        const provider = ctx.prefer ? getProvider(ctx.prefer) : null;
        const nativeSupported = provider?.supports(CAPABILITY.FILES, { model: ctx.model })
          && provider.supports(CAPABILITY.PDF, { model: ctx.model });
        const localSupported = Boolean(pdfExtractor?.implemented);

        if (!localSupported && nativeSupported) {
          return applyNativeFile(ctx, input);
        }
      }

      if (isImage(input)) {
        const provider = ctx.prefer ? getProvider(ctx.prefer) : null;
        const nativeSupported = provider?.supports(CAPABILITY.FILES, { model: ctx.model })
          && provider.supports(CAPABILITY.IMAGES, { model: ctx.model })
          && provider.supports(CAPABILITY.VISION, { model: ctx.model });
        if (nativeSupported) return applyNativeFile(ctx, input);
        const error = new Error("The provided file type is not supported for local extraction. Supported types: PDF and DOCX files.");
        error.code = "AI_RESOURCE_UNSUPPORTED";
        throw error;
      }

      if (isPdf(input)) {
        const { listByCategory } = await import("../../../resources");
        const pdfExtractor = listByCategory("documents").find((extractor) => extractor.id === "pdf");
        if (!pdfExtractor?.implemented) {
          const error = new Error("PDF extraction is unavailable in this environment.");
          error.code = "AI_RESOURCE_UNSUPPORTED";
          throw error;
        }
      }

      const { extractResource } = await import("../../../resources");
      const resource = await extractResource(input);
      ctx.normalizedInput = resource;
      ctx.resolvedInputType = resource.kind;
      ctx.text = resource.text || null;
      ctx.warnings = (ctx.warnings || []).concat(resource.warnings || []);
      return { success: true };
    } catch (err) {
      return {
        fatal: true,
        errors: [{ stage: "resource-normalization", code: err.code, message: err.message || "resource extraction failed" }],
      };
    }
  },
};

export default stage;
