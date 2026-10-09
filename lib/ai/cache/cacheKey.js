import crypto from "crypto";

function stableSerialize(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(String(value));
  if (Array.isArray(value)) {
    return "[" + value.map(stableSerialize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableSerialize(value[k])).join(",") + "}";
}

export function deterministicCacheKey({ normalizedInput, promptId, promptVersion, schemaId, schemaVersion, providerId, modelId, capabilityProfile, extra }) {
  const parts = [
    String(normalizedInput || ""),
    String(promptId || ""),
    String(promptVersion || ""),
    String(schemaId || ""),
    String(schemaVersion || ""),
    String(providerId || ""),
    String(modelId || ""),
    stableSerialize(capabilityProfile || {}),
    stableSerialize(extra || {}),
  ];
  return crypto.createHash("sha256").update(parts.join("\u241F")).digest("hex");
}

export function shortKey(hash, prefix = "ai:ext") {
  return `${prefix}:${hash.slice(0, 40)}`;
}
