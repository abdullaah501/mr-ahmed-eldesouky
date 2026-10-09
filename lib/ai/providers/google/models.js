export const MODELS = [
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    default: true,
    // 3.x models ship UNMARKED (no reasoningControl): the legacy 2.x
    // thinkingBudget control is rejected by 3.x (HTTP 400), and no 3.x
    // thinking control has been verified for this model. Unmarked → the
    // adapter omits generationConfig.thinkingConfig entirely (graceful
    // degradation to the AI Assist guard + anti-reasoning prompt rule).
    // Verify a generation-correct control against the SPECIFIC model before
    // ever adding a reasoningControl value here.
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    quota: {
      // Project-dependent — verify in Google AI Studio
      rpm: null,
      rpd: null,
      tpm: null,
    },
    capabilities: {
      vision: true,
      files: true,
      pdf: true,
      images: false,
    },
  },

  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    // UNMARKED (3.x) — observed working with NO thinking control; see the
    // 3.5-flash-lite comment above.
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    quota: {
      // Project-dependent — verify in Google AI Studio
      rpm: null,
      rpd: null,
      tpm: null,
    },
    capabilities: {
      vision: true,
      files: true,
      pdf: true,
      images: false,
    },
  },

  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    // UNMARKED (3.x) — no verified thinking control; see the 3.5-flash-lite comment.
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    quota: {
      // Project-dependent — verify in Google AI Studio
      rpm: null,
      rpd: null,
      tpm: null,
    },
    capabilities: {
      vision: true,
      files: true,
      pdf: true,
      images: false,
    },
  },

  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    // UNMARKED (3.x) — thinkingLevel/disable is model-dependent; graceful
    // degradation. Original documented design (never marked).
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    quota: {
      // Project-dependent — verify in Google AI Studio
      rpm: null,
      rpd: null,
      tpm: null,
    },
    capabilities: {
      vision: true,
      files: true,
      pdf: true,
      images: false,
    },
  },

  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    // UNMARKED (3.x) — control support requires verification against this
    // specific model (currently capacity-limited upstream); omission is safe.
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
    },
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    quota: {
      // Project-dependent — verify in Google AI Studio
      rpm: null,
      rpd: null,
      tpm: null,
    },
    capabilities: {
      vision: true,
      files: true,
      pdf: true,
      images: false,
    },
  },
];
