import crypto from "crypto";

const VALID_TYPES = new Set([
  "structured-context",
  "missing-data-request",
  "draft-questions",
  "canonical-json",
  "import-report",
]);

const REQUIRED_METADATA = ["taskId", "provider", "model", "promptVersion", "schemaVersion", "createdAt"];

export function wrapEnvelope(type, version, data, producerMeta = {}, parentId = null) {
  const metadata = {};
  for (const key of REQUIRED_METADATA) {
    metadata[key] = producerMeta[key] != null ? producerMeta[key] : null;
  }
  if (producerMeta.createdAt == null) {
    metadata.createdAt = new Date().toISOString();
  }
  return {
    id: crypto.randomUUID(),
    parentId: parentId || null,
    type,
    version: String(version),
    data,
    metadata,
  };
}

export function assertEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, errors: ["envelope must be an object"] };
  }
  const errors = [];
  if (typeof envelope.id !== "string" || !envelope.id) {
    errors.push("envelope.id must be a non-empty string");
  }
  if (envelope.parentId !== null && typeof envelope.parentId !== "string") {
    errors.push("envelope.parentId must be null or a string");
  }
  if (typeof envelope.type !== "string" || !envelope.type) {
    errors.push("envelope.type must be a non-empty string");
  }
  if (typeof envelope.version !== "string") {
    errors.push("envelope.version must be a string");
  }
  if (!("data" in envelope)) {
    errors.push("envelope.data is required");
  }
  if (!envelope.metadata || typeof envelope.metadata !== "object") {
    errors.push("envelope.metadata must be an object");
  }
  return { ok: errors.length === 0, errors };
}

export function chainLineage(...envelopes) {
  return envelopes.map((e) => ({ id: e.id, parentId: e.parentId, type: e.type, version: e.version }));
}

export { VALID_TYPES };