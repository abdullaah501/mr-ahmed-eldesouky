const plugins = new Map();

function assertPlugin(plugin) {
  if (!plugin || typeof plugin !== "object") {
    throw new Error("Question plugin must be an object");
  }
  if (!plugin.type || typeof plugin.type !== "string") {
    throw new Error("Question plugin must have a string type");
  }
  if (plugin.apiVersion !== undefined && typeof plugin.apiVersion !== "number") {
    throw new Error("Question plugin apiVersion must be a number");
  }
  if (plugin.meta !== undefined && typeof plugin.meta !== "object") {
    throw new Error("Question plugin meta must be an object");
  }
  if (plugin.features !== undefined && !Array.isArray(plugin.features)) {
    throw new Error("Question plugin features must be an array");
  }
}

export function register(plugin) {
  assertPlugin(plugin);

  const features = new Set(plugin.features || []);
  const processedPlugin = { ...plugin, features };

  const existing = plugins.get(plugin.type) || {};
  plugins.set(plugin.type, { ...existing, ...processedPlugin });
}

export function get(type) {
  return plugins.get(type) || null;
}

export function listTypes() {
  return [...plugins.keys()];
}

export function validate(type, input) {
  const p = get(type);
  if (!p) return { ok: false, errors: ["Unknown question type"] };
  return p.validate ? p.validate(input) : { ok: true, errors: [] };
}

export function normalize(type, input) {
  const p = get(type);
  if (!p) throw new Error(`Unknown question type: ${type}`);
  return p.normalize ? p.normalize(input) : input;
}

export function grade(type, question, answer) {
  const p = get(type);
  if (!p?.grade) return null;
  return p.grade(question, answer);
}

/**
 * Optional Word-export capability. Returns format-neutral descriptors from
 * the plugin's `toDocxContent`, or null when the plugin is missing, has no
 * formatter, throws, or returns invalid output — callers fall back safely.
 */
export function docxContent(type, question, context) {
  const p = get(type);
  if (!p?.toDocxContent) return null;
  try {
    const descriptors = p.toDocxContent(question, context);
    return Array.isArray(descriptors) ? descriptors : null;
  } catch {
    return null;
  }
}

export function meta(type) {
  const p = get(type);
  return p?.meta || {};
}

export function blank(type) {
  const p = get(type);
  return p?.blank ? p.blank() : null;
}
