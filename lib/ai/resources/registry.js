const extractors = new Map();

function assertExtractor(ext) {
  if (!ext || typeof ext !== "object") {
    throw new Error("Resource extractor must be an object");
  }
  if (!ext.id || typeof ext.id !== "string") {
    throw new Error("Resource extractor must have a string id");
  }
  if (!ext.category || typeof ext.category !== "string") {
    throw new Error(`Resource extractor "${ext.id}" must declare a category (documents|images|urls|repository)`);
  }
  if (typeof ext.canHandle !== "function") {
    throw new Error(`Resource extractor "${ext.id}" must implement canHandle(input)`);
  }
  if (typeof ext.extract !== "function") {
    throw new Error(`Resource extractor "${ext.id}" must implement extract(input)`);
  }
}

export function registerExtractor(extractor) {
  assertExtractor(extractor);
  extractors.set(extKey(extractor), extractor);
}

function extKey(extractor) {
  return `${extractor.category}:${extractor.id}`;
}

export function listExtractors() {
  return [...extractors.values()];
}

export function listByCategory(category) {
  return [...extractors.values()].filter((e) => e.category === category);
}

export function getExtractor(id) {
  for (const e of extractors.values()) if (e.id === id) return e;
  return null;
}

export function clearExtractors() {
  extractors.clear();
}

export function resolveExtractor(input) {
  if (!input) return null;
  const candidates = [...extractors.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const ext of candidates) {
    try {
      if (ext.implemented === false) continue;
      if (ext.canHandle(input)) return ext;
    } catch {
      continue;
    }
  }
  return null;
}