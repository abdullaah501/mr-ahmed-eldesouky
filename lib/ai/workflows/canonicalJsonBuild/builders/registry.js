const builders = new Map();

function assertBuilder(builder) {
  if (!builder || typeof builder !== "object") {
    throw new Error("Canonical builder must be an object");
  }
  if (!builder.id || typeof builder.id !== "string") {
    throw new Error("Canonical builder must have a string id");
  }
  if (typeof builder.build !== "function") {
    throw new Error(`Canonical builder "${builder.id}" must implement build(draftQuestions, ctx)`);
  }
}

export function registerBuilder(builder) {
  assertBuilder(builder);
  builders.set(builder.id, builder);
}

export function resolveBuilder(id) {
  return builders.get(id) || null;
}

export function listBuilders() {
  return [...builders.keys()];
}

export function clearBuilders() {
  builders.clear();
}