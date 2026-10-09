import { registerProvider, clearProviders } from "../../../lib/ai/providers/registry";
import { resolveCapability } from "../../../lib/ai/providers/base/BaseProviderAdapter";

export function makeFakeProvider({
  id = "fake",
  label = "Fake",
  failTimes = 0,
  object = null,
  text = "fake-text",
  supportsAll = true,
  usage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  cost = 0.001,
  store = null,
} = {}) {
  let calls = 0;
  const adapter = {
    id,
    label,
    implemented: true,
    capabilities: {
      files: supportsAll,
      pdf: supportsAll,
      word: supportsAll,
      images: supportsAll,
      jsonMode: supportsAll,
      structuredOutput: supportsAll,
      streaming: supportsAll,
      tools: supportsAll,
      longContext: supportsAll,
      vision: supportsAll,
      reasoning: supportsAll,
    },
    models: [{ id: "fake-model", pricing: { inputPer1M: 1, outputPer1M: 2 }, contextWindow: 4096 }],
    apiKey() { return "test-key"; },
    supports(cap, opts) {
      return resolveCapability(adapter, cap, opts);
    },
    async generateText() {
      calls += 1;
      if (calls <= failTimes) {
        const e = new Error("fail");
        e.status = 500;
        throw e;
      }
      if (store) store.push({ id, op: "generateText", calls });
      return { provider: id, model: "fake-model", text, usage, raw: {} };
    },
    async generateObject({ schema } = {}) {
      calls += 1;
      if (calls <= failTimes) {
        const e = new Error("fail");
        e.status = 500;
        throw e;
      }
      if (store) store.push({ id, op: "generateObject", calls });
      return { provider: id, model: "fake-model", object: object || {}, usage, raw: {} };
    },
    extract(input) {
      return adapter.generateObject(input);
    },
    async *streamText() {
      calls += 1;
      yield { provider: id, model: "fake-model", text };
    },
    estimateCost({ usage: u }) {
      if (u == null) return null;
      const inTok = u.promptTokens ?? 0;
      const outTok = u.completionTokens ?? 0;
      return (inTok / 1_000_000) * 1 + (outTok / 1_000_000) * 2;
    },
    countTokens({ text: t }) {
      return Math.ceil(String(t || "").length / 4);
    },
    _getCalls() {
      return calls;
    },
  };
  return adapter;
}

export function registerFakeProvider(opts) {
  const adapter = makeFakeProvider(opts);
  clearProviders();
  registerProvider(adapter);
  return adapter;
}