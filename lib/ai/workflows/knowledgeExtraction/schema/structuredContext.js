export const SCHEMA_ID = "structured-context";
export const SCHEMA_VERSION = "1";

function isObj(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isStringOrNum(v) {
  return typeof v === "string" || typeof v === "number";
}

function pushLow(meta, path) {
  if (!meta.lowConfidence) meta.lowConfidence = [];
  meta.lowConfidence.push(path);
}

function checkConfidenceField(value, path, meta) {
  let obj;
  if (isStringOrNum(value)) {
    return;
  }
  if (!isObj(value)) return;
  obj = value;
  const conf = obj.confidence;
  if (typeof conf === "number" && conf < 0.5) {
    pushLow(meta, path);
  }
}

function checkListField(list, path, meta) {
  if (!Array.isArray(list)) return;
  let i = 0;
  for (const item of list) {
    checkConfidenceField(item, `${path}[${i}]`, meta);
    i++;
  }
}

export const COMPLETENESS_ERROR = "StructuredContext must contain at least one of: subject, topics, lessonTitle";
export const COMPLETENESS_FIELDS = ["subject", "topics", "lessonTitle"];

export function assertStructuredContextShape(value) {
  if (!isObj(value)) {
    return { ok: false, errors: ["StructuredContext must be an object"] };
  }

  const errors = [];

  const listFields = [
    "topics", "concepts", "objectives", "definitions", "formulas", "dates",
    "terminology", "importantFacts", "learningOutcomes", "questionHints",
    "difficultyClues", "missingInformation", "ambiguities", "unsupportedAreas",
  ];
  for (const f of listFields) {
    if (f in value && value[f] !== null && !Array.isArray(value[f])) {
      errors.push(`Field "${f}" must be an array`);
    }
  }

  const scalarFields = ["subject", "grade", "language", "curriculum", "lessonTitle"];
  for (const f of scalarFields) {
    if (f in value && value[f] !== null && typeof value[f] !== "string" && !isObj(value[f])) {
      errors.push(`Field "${f}" must be a string or { value, confidence, sourceRanges }`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function isMissing(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isObj(value) && "value" in value) return isMissing(value.value);
  return false;
}

export function assessContextCompleteness(value) {
  const missing = COMPLETENESS_FIELDS.filter((field) => isMissing(value?.[field]));
  return { complete: missing.length < COMPLETENESS_FIELDS.length, missing };
}

export function assertStructuredContext(value) {
  const shape = assertStructuredContextShape(value);
  if (!shape.ok) return shape;

  const hasNoDeclaredCoreField = COMPLETENESS_FIELDS.every((field) => typeof value[field] === "undefined");
  return hasNoDeclaredCoreField
    ? { ok: false, errors: [...shape.errors, COMPLETENESS_ERROR] }
    : shape;
}

export function collectLowConfidence(value) {
  const meta = value?._meta || {};
  meta.lowConfidence = [];

  const scalarFields = ["subject", "grade", "curriculum", "lessonTitle"];
  for (const f of scalarFields) {
    if (value && value[f] != null) {
      checkConfidenceField(value[f], f, meta);
    }
  }

  const listFields = [
    "topics", "concepts", "objectives", "definitions", "formulas", "dates",
    "terminology", "importantFacts", "learningOutcomes", "questionHints",
    "difficultyClues",
  ];
  for (const f of listFields) {
    if (value && Array.isArray(value[f])) {
      checkListField(value[f], f, meta);
    }
  }

  if (value && isObj(value._meta)) {
    value._meta.lowConfidence = meta.lowConfidence;
  }
  return meta.lowConfidence;
}

export const schema = {
  id: SCHEMA_ID,
  version: SCHEMA_VERSION,
  assert: assertStructuredContext,
  assertShape: assertStructuredContextShape,
  assessCompleteness: assessContextCompleteness,
};

export default schema;
