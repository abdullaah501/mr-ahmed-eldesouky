import { AI_DEFAULTS } from "../../../config/defaults";
import { getRequiredFields } from "../requiredFields";

function threshold() {
  return AI_DEFAULTS.lowConfidence.threshold;
}

function valueOf(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

function matchesOptions(value, options) {
  const candidate = valueOf(value);
  if (Array.isArray(candidate)) return candidate.length > 0 && candidate.every((item) => options.includes(item));
  return options.includes(candidate);
}

function classifyField(field, context, params) {
  const { key, source } = field;

  let current = null;
  if (source === "context") {
    current = context ? context[key] : null;
  } else {
    current = params ? params[key] : null;
  }

  if (current == null || current === "" || (Array.isArray(current) && current.length === 0)) {
    return { reason: "absent", current: null };
  }

  if (source === "context" && current && typeof current === "object" && "confidence" in current) {
    const conf = Number(current.confidence);
    if (Number.isFinite(conf) && conf < threshold()) {
      return { reason: "low-confidence", current };
    }
  }

  if (field.options && !matchesOptions(current, field.options)) {
    return { reason: "non-canonical", current };
  }

  return { reason: "present", current };
}

function buildMissingEntry(field, classification) {
  const entry = {
    key: field.key,
    priority: field.priority,
    required: field.required,
    editable: field.editable,
    reason: classification.reason,
    current: classification.current,
    label: field.label,
  };
  if (field.options) {
    entry.options = field.options;
  }
  return entry;
}

const stage = {
  name: "inspect",
  async run(ctx) {
    const context = ctx.inputs.context;
    const answers = ctx.inputs.answers || {};
    const params = ctx.inputs.generationParams || {};

    // Grade options are resolved from the Grade collection per run.
    const fields = await getRequiredFields();

    let enrichedContext = context ? { ...context } : {};
    if (enrichedContext._meta == null && context?._meta != null) {
      enrichedContext._meta = { ...context._meta };
    }

    if (answers && typeof answers === "object") {
      for (const [key, value] of Object.entries(answers)) {
        if (value != null && value !== "") {
          const fieldDef = fields.find((f) => f.key === key);
          if (fieldDef && fieldDef.source === "context") {
            enrichedContext[key] = value;
          } else if (fieldDef && fieldDef.source === "params") {
            params[key] = value;
          }
        }
      }
    }

    const missingFields = [];
    for (const field of fields) {
      const classification = classifyField(field, enrichedContext, params);
      if (classification.reason !== "present" && field.required) {
        missingFields.push(buildMissingEntry(field, classification));
      } else if (classification.reason !== "present" && !field.required) {
        missingFields.push(buildMissingEntry(field, classification));
      }
    }

    ctx.inputs.context = enrichedContext;
    ctx.inputs.generationParams = params;

    ctx.outputs.missingFields = missingFields;
    ctx.outputs.isComplete = missingFields.every((f) => !f.required);

    return { success: true };
  },
};

export default stage;
