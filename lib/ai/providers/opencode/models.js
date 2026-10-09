export const MODELS = [
  {
    id: "mimo-v2.5-free",
    label: "MiMo V2.5",
    default: true,
    pricing: { inputPer1M: 0, outputPer1M: 0 },
    contextWindow: 256_000,
    maxOutputTokens: 8_192,
  },
  {
    id: "deepseek-v4-flash-free",
    label: "DeepSeek V4 Flash",
    pricing: { inputPer1M: 0, outputPer1M: 0 },
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    capabilities: { vision: true, images: true },
  },
  {
    id: "ling-3.0-flash-free",
    label: "Ling 3.0 Flash",
    pricing: { inputPer1M: 0, outputPer1M: 0 },
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    capabilities: { vision: true, images: true },
  },
];