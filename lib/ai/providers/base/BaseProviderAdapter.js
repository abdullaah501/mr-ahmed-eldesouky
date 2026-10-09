import { CAPABILITY } from "../../types/capabilities";

const REQUIRED_METHODS = ["supports", "generateText", "generateObject", "streamText", "extract", "estimateCost", "countTokens"];

export function assertProviderAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new Error("Provider adapter must be an object");
  }
  if (!adapter.id || typeof adapter.id !== "string") {
    throw new Error("Provider adapter must have a string id");
  }
  if (!adapter.label || typeof adapter.label !== "string") {
    throw new Error(`Provider "${adapter.id}" must have a string label`);
  }
  if (!adapter.capabilities || typeof adapter.capabilities !== "object") {
    throw new Error(`Provider "${adapter.id}" must declare static capabilities`);
  }
  for (const m of REQUIRED_METHODS) {
    if (typeof adapter[m] !== "function") {
      throw new Error(`Provider "${adapter.id}" must implement ${m}()`);
    }
  }
}

export function resolveCapability(adapter, capability, { model } = {}) {
  if (capability === CAPABILITY.STRUCTURED_OUTPUT) {
    const caps = adapter.capabilities;
    return Boolean(caps.structuredOutput || caps.jsonMode);
  }
  if (model && Array.isArray(adapter.models)) {
    const entry = adapter.models.find((m) => m.id === model);
    if (entry && entry.capabilities && capability in entry.capabilities) {
      return Boolean(entry.capabilities[capability]);
    }
  }
  return Boolean(adapter.capabilities[capability]);
}