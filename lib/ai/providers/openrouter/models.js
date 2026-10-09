export const MODELS = [
  {
    id: "liquid/lfm-2.5-2.6b:free",
    label: "LFM 2.5 2.6B",
    default: true,
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 65_536,
    maxOutputTokens: 8_192,
    capabilities: {
      vision: false,
      images: false,
      video: false,
      pdf: false,
      jsonMode: true,
      structuredOutputs: true,
      strictStructuredOutputs: false,
      toolUse: true,
    },
  },
 {
    id: "cohere/north-mini-code:free",
    label: "North Mini Code",
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 256_000,
    maxOutputTokens: 65_536,
    capabilities: {
      vision: false,
      images: false,
      video: false,
      pdf: false,
      jsonMode: true,
      structuredOutputs: false,
      strictStructuredOutputs: false,
      toolUse: false,
    },
  },

  {
    id: "poolside/laguna-s-2.1:free",
    label: "Laguna S 2.1",
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 512_000,
    maxOutputTokens: 512_000,
    capabilities: {
      vision: true,
      images: true,
      video: false,
      pdf: false,
      jsonMode: true,
      structuredOutputs: true,
      strictStructuredOutputs: false,
      toolUse: true,
    },
  },
];
