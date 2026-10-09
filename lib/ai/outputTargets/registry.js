const targets = new Map();

function assertTarget(target) {
  if (!target || typeof target !== "object") {
    throw new Error("Output target must be an object");
  }
  if (!target.id || typeof target.id !== "string") {
    throw new Error("Output target must have a string id");
  }
  if (typeof target.write !== "function") {
    throw new Error(`Output target "${target.id}" must implement write({ artifact, metadata, options })`);
  }
}

export function registerOutputTarget(target) {
  assertTarget(target);
  targets.set(target.id, target);
}

export function listOutputTargets() {
  return [...targets.values()];
}

export function resolveOutputTarget(id) {
  return targets.get(id) || null;
}

export function clearOutputTargets() {
  targets.clear();
}