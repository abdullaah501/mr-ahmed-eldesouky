import "./bootstrap";
import { resolveExtractor } from "./registry";
import { AiError, AiErrorCode } from "../types/errors";
import { normalizeText, truncate } from "./textNormalization";
import { AI_DEFAULTS } from "../config/defaults";

export async function extractResource(input) {
  if (!input) {
    throw new AiError(AiErrorCode.RESOURCE_UNSUPPORTED, "No resource input provided");
  }

  let textInput = null;
  if (typeof input === "string") {
    textInput = input;
  } else if (input.text) {
    textInput = input.text;
  }

  if (textInput) {
    const normalized = truncate(
      normalizeText(textInput),
      AI_DEFAULTS.input.maxInputChars
    );
    return {
      kind: "inline",
      text: normalized,
      metadata: { resourceKind: "inline", extractorId: "inline-text", sourceMime: "text/plain" },
      refs: [],
      warnings: [],
    };
  }

  const extractor = resolveExtractor(input);
  if (!extractor) {
    throw new AiError(
      AiErrorCode.RESOURCE_UNSUPPORTED,
      "No resource extractor handled the input",
      { inputKind: input?.kind, fileName: input?.name, mime: input?.mimetype || input?.mimeType }
    );
  }

  const result = await extractor.extract(input);
  if (result && typeof result.text === "string") {
    result.text = truncate(
      normalizeText(result.text),
      AI_DEFAULTS.input.maxInputChars
    );
  }
  return {
    kind: extractor.category,
    ...result,
  };
}

export { resolveExtractor, listExtractors, listByCategory, registerExtractor } from "./registry";
export { normalizeText, truncate } from "./textNormalization";