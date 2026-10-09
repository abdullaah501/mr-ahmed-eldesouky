const plugins = new Map();

function assertPlugin(plugin) {
  if (!plugin || typeof plugin !== "object") {
    throw new Error("Import plugin must be an object");
  }
  if (!plugin.id || typeof plugin.id !== "string") {
    throw new Error(`Import plugin "${plugin.id || "?"}" must have a string id`);
  }
  if (!plugin.label || typeof plugin.label !== "string") {
    throw new Error(`Import plugin "${plugin.id}" must have a string label`);
  }
  if (typeof plugin.version !== "number") {
    throw new Error(`Import plugin "${plugin.id}" must have a numeric version`);
  }
  if (!plugin.extensions || !Array.isArray(plugin.extensions)) {
    throw new Error(`Import plugin "${plugin.id}" must have an extensions array`);
  }
  if (typeof plugin.canImport !== "function") {
    throw new Error(`Import plugin "${plugin.id}" must export a canImport() function`);
  }
  if (typeof plugin.parse !== "function") {
    throw new Error(`Import plugin "${plugin.id}" must export a parse() function`);
  }
}

export function registerImportPlugin(plugin) {
  assertPlugin(plugin);
  plugins.set(plugin.id, { ...plugin });
}

export function ensurePluginsRegistered() {
  // bootstrap — intentionally empty; registration happens via side-effect imports
}

export function listPlugins() {
  return [...plugins.values()];
}

export function getPluginById(id) {
  return plugins.get(id) || null;
}

export function resolvePlugin(file) {
  const candidates = listPlugins()
    .filter((p) => p.implemented === true && typeof p.canImport === "function" && p.canImport(file))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return candidates[0] || null;
}
