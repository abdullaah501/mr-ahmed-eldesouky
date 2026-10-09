const schemas = new Map();

export function registerSchema(schema) {
  if (!schema || typeof schema !== "object") {
    throw new Error("Schema must be an object");
  }
  if (!schema.id || typeof schema.id !== "string") {
    throw new Error("Schema must declare a string id");
  }
  if (typeof schema.version !== "string") {
    throw new Error(`Schema "${schema.id}" must declare a string version`);
  }
  if (typeof schema.assert !== "function") {
    throw new Error(`Schema "${schema.id}@${schema.version}" must implement assert(value)`);
  }
  schemas.set(`${schema.id}@${schema.version}`, schema);
}

export function getSchema(id, version) {
  return schemas.get(`${id}@${version}`) || null;
}

export function listSchemas() {
  return [...schemas.keys()];
}

export function clearSchemas() {
  schemas.clear();
}