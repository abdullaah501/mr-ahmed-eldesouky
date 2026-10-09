export const MODELS = [
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    default: true,
    reasoningControl: "groq_reasoning",
    pricing: {
      inputPer1M: 0.15,
      outputPer1M: 0.60,
    },
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    quota: {
      rpm: 30,
      rpd: 1_000,
      tpm: 8_000,
      tpd: 200_000,
    },
    capabilities: {
      vision: false,
      images: false,
      files: false,
      structuredOutputs: true,
      reasoning: true,
    },
  },

  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    reasoningControl: "groq_reasoning",
    pricing: {
      inputPer1M: 0.075,
      outputPer1M: 0.30,
    },
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    quota: {
      rpm: 30,
      rpd: 1_000,
      tpm: 8_000,
      tpd: 200_000,
    },
    capabilities: {
      vision: false,
      images: false,
      files: false,
      structuredOutputs: true,
      reasoning: true,
    },
  },
];
