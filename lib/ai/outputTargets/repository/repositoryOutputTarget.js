import { registerOutputTarget } from "../registry";

function toBuffer(canonicalJson) {
  if (Buffer.isBuffer(canonicalJson)) return canonicalJson;
  if (typeof canonicalJson === "string") return Buffer.from(canonicalJson, "utf-8");
  return Buffer.from(JSON.stringify(canonicalJson), "utf-8");
}

function buildFileLike(canonicalJson) {
  const buffer = toBuffer(canonicalJson);
  return {
    name: "generated-ai.json",
    type: "application/json",
    size: buffer.length,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

async function getImportEngine() {
  const { ImportEngine } = await import("../../../import/core/ImportEngine");
  return ImportEngine;
}

export const repositoryOutputTarget = {
  id: "repository",
  implemented: true,

  async write({ artifact, metadata = {}, options = {} } = {}) {
    if (!artifact || artifact.type !== "canonical-json") {
      return {
        ok: false,
        target: this.id,
        report: {},
        errors: [{ code: "AI_INVALID_ARTIFACT", message: "Expected a canonical-json artifact" }],
      };
    }

    const userId = metadata.userId || metadata.user?.id || null;
    if (!userId) {
      return {
        ok: false,
        target: this.id,
        report: {},
        errors: [{ code: "AI_NO_USER", message: "userId is required for repository import" }],
      };
    }

    let result;
    try {
      const ImportEngine = await getImportEngine();
      const fileLike = buildFileLike(artifact.data);
      result = await ImportEngine.importFile(fileLike, { userId, options });
    } catch (error) {
      return {
        ok: false,
        target: this.id,
        report: { imported: 0, failed: 0, skipped: 0, warnings: 0, duration: 0 },
        errors: [{ code: "AI_IMPORT_FAILED", message: error?.message || "Import failed" }],
      };
    }

    const ok = result.success !== false;
    return {
      ok,
      target: this.id,
      report: result.report || {},
      errors: result.errors || [],
    };
  },
};

registerOutputTarget(repositoryOutputTarget);
export default repositoryOutputTarget;