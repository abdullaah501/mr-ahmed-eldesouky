import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";

// Regression tests for the confirmed production bug: streaming adapters must
// classify HTTP 429 as AI_RATE_LIMITED (retryable, Retry-After aware) exactly
// like their non-stream callCompletions paths instead of the generic
// AI_BAD_RESPONSE.
vi.hoisted(() => {
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
});

vi.mock("../../lib/ai/metrics/aiMetrics", () => ({
  emitAiEvent: vi.fn(),
  emitAiRun: vi.fn(),
  emitCacheEvent: vi.fn(),
  emitBudgetEvent: vi.fn(),
  emitBreakerEvent: vi.fn(),
}));

import { groqAdapter } from "../../lib/ai/providers/groq/adapter";
import { openrouterAdapter } from "../../lib/ai/providers/openrouter/adapter";
import { googleAdapter } from "../../lib/ai/providers/google/adapter";
import { AiErrorCode } from "../../lib/ai/types/errors";

const originalFetch = global.fetch;
const originalKeys = {
  groq: process.env.GROQ_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

function sseBody(frames) {
  const encoder = new TextEncoder();
  const text = frames.map((payload) => `data: ${payload}\n\n`).join("");
  let sent = false;
  return {
    getReader() {
      return {
        read: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: encoder.encode(text) };
        },
        cancel: async () => {},
      };
    },
  };
}

function makeRes({ status, retryAfter = null, frames = [] }) {
  const ok = status >= 200 && status < 300;
  const headers = { get: (name) => (name.toLowerCase() === "retry-after" ? retryAfter : null) };
  return {
    ok,
    status,
    headers,
    body: ok ? sseBody(frames) : null,
  };
}

function mockFetchOnce(res) {
  global.fetch = vi.fn(async () => res);
}

const MESSAGES = [{ role: "user", content: "hi" }];

describe.each([
  ["groq", groqAdapter],
  ["openrouter", openrouterAdapter],
])("%s streamText error classification", (label, adapter) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("HTTP 429 maps to AI_RATE_LIMITED with extra.status = 429", async () => {
    mockFetchOnce(makeRes({ status: 429 }));
    await expect(adapter.streamText({ messages: MESSAGES }).next()).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
      extra: { status: 429 },
    });
  });

  it("parses the Retry-After header", async () => {
    mockFetchOnce(makeRes({ status: 429, retryAfter: "30" }));
    await expect(adapter.streamText({ messages: MESSAGES }).next()).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
      extra: { status: 429, retryAfterSeconds: 30 },
    });
  });

  it("missing Retry-After header results in retryAfterSeconds = null", async () => {
    mockFetchOnce(makeRes({ status: 429, retryAfter: null }));
    await expect(adapter.streamText({ messages: MESSAGES }).next()).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
      extra: { status: 429, retryAfterSeconds: null },
    });
  });

  it("non-429 non-OK keeps the existing mapped code and extra.status (401)", async () => {
    mockFetchOnce(makeRes({ status: 401 }));
    await expect(adapter.streamText({ messages: MESSAGES }).next()).rejects.toMatchObject({
      code: AiErrorCode.PROVIDER_DISABLED,
      extra: { status: 401 },
    });
  });

  it("non-429 non-OK keeps the existing mapped code and extra.status (500)", async () => {
    mockFetchOnce(makeRes({ status: 500 }));
    await expect(adapter.streamText({ messages: MESSAGES }).next()).rejects.toMatchObject({
      code: AiErrorCode.BAD_RESPONSE,
      extra: { status: 500 },
    });
  });

  it("preserves successful stream behavior", async () => {
    mockFetchOnce(
      makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"delta"}}]}', "[DONE]"],
      })
    );
    const chunks = [];
    for await (const chunk of adapter.streamText({ messages: MESSAGES })) {
      chunks.push(chunk);
    }
    expect(chunks.map((c) => c.text).join("")).toBe("delta");
    // Chunks keep the provider-agnostic shape consumed by AI Assist.
    for (const chunk of chunks) {
      expect(chunk).toMatchObject({ provider: label, model: expect.any(String) });
    }
  });
});

describe("non-stream parity (callCompletions 429 semantics unchanged)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groq non-stream 429 still maps to RATE_LIMITED", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { get: () => "5" } });
    await expect(groqAdapter.generateText({ messages: MESSAGES })).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
      extra: { status: 429, retryAfterSeconds: 5 },
    });
  });

  it("openrouter non-stream 429 still maps to RATE_LIMITED", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { get: () => "5" } });
    await expect(openrouterAdapter.generateText({ messages: MESSAGES })).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
      extra: { status: 429, retryAfterSeconds: 5 },
    });
  });
});

describe("groq provider-native reasoning control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends reasoning_effort=none + reasoning_format=hidden for the marked default model", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      });
    });
    // Default model = openai/gpt-oss-120b (catalog capability groq_reasoning).
    for await (const c of groqAdapter.streamText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(captured[0]).toMatchObject({
      reasoning_effort: "none",
      reasoning_format: "hidden",
    });
  });

  it("sends native controls in NON-STREAM bodies too", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "x" } }], usage: {} }) };
    });
    await groqAdapter.generateText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    });
    expect(captured[0]).toMatchObject({
      reasoning_effort: "none",
      reasoning_format: "hidden",
    });
  });

  it("sends NO reasoning fields for a groq model outside the catalog", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      });
    });
    // Model id with no catalog entry -> no reasoningControl capability.
    for await (const c of groqAdapter.streamText({
      messages: MESSAGES,
      model: "legacy/uncatalogued-model",
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(captured[0]).not.toHaveProperty("reasoning_effort");
    expect(captured[0]).not.toHaveProperty("reasoning_format");
  });

  it("omits reasoning body fields when the caller provides no reasoning options", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      });
    });
    for await (const c of groqAdapter.streamText({ messages: MESSAGES })) {
      void c;
    }
    expect(captured[0]).not.toHaveProperty("reasoning_effort");
    expect(captured[0]).not.toHaveProperty("reasoning_format");
  });

  it("telemetry reports catalog control + actual body mutation", async () => {
    const { emitAiEvent } = await import("../../lib/ai/metrics/aiMetrics");
    const mockEmit = vi.mocked(emitAiEvent);
    global.fetch = vi.fn(async () =>
      makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      })
    );

    mockEmit.mockClear();
    for await (const c of groqAdapter.streamText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(mockEmit).toHaveBeenCalledWith("provider_reasoning_control", {
      provider: "groq",
      model: "openai/gpt-oss-120b",
      control: "groq_reasoning_effort",
      applied: true,
    });

    mockEmit.mockClear();
    for await (const c of groqAdapter.streamText({
      messages: MESSAGES,
      model: "legacy/uncatalogued-model",
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(mockEmit).toHaveBeenCalledWith("provider_reasoning_control", {
      provider: "groq",
      model: "legacy/uncatalogued-model",
      control: "groq_reasoning_effort",
      applied: false,
    });
  });

  it("catalog guard: groq marks are exactly the approved gpt-oss models", async () => {
    const { MODELS } = await import("../../lib/ai/providers/groq/models");
    const marked = MODELS.filter((m) => m.reasoningControl === "groq_reasoning");
    expect(marked.map((m) => m.id)).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  });
});

describe("provider-specific reasoning fields do NOT leak into unrelated adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openrouter never receives groq reasoning fields", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      });
    });
    for await (const c of openrouterAdapter.streamText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(captured[0]).not.toHaveProperty("reasoning_effort");
    expect(captured[0]).not.toHaveProperty("reasoning_format");
    expect(captured[0]).not.toHaveProperty("reasoning");
  });

  it("google adapter request body carries no reasoning fields", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "x" }] } }],
          usageMetadata: {},
        }),
      };
    });
    const result = await googleAdapter.generateText({
      messages: MESSAGES,
      options: { reasoningEffort: "none", reasoningFormat: "hidden" },
    });
    expect(result.text).toBe("x");
    expect(captured[0]).not.toHaveProperty("reasoning_effort");
    expect(captured[0]).not.toHaveProperty("reasoning_format");
  });
});

describe("google provider-native reasoning control (final catalog is unmarked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no catalog model receives thinkingConfig when reasoning is disabled", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "x" }] } }],
          usageMetadata: {},
        }),
      };
    });
    const { MODELS } = await import("../../lib/ai/providers/google/models");
    for (const model of MODELS.map((m) => m.id)) {
      await googleAdapter.generateText({
        messages: MESSAGES,
        model,
        options: { reasoning: { enabled: false } },
      });
      expect(captured.at(-1).generationConfig).not.toHaveProperty("thinkingConfig");
      expect(JSON.stringify(captured.at(-1))).not.toContain("thinkingBudget");
    }
  });

  it("stream requests carry no thinkingConfig either", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      const encoder = new TextEncoder();
      const payload = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "x" }] } }] })}\n\n`;
      let sent = false;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: encoder.encode(payload) };
              },
              cancel: async () => {},
            };
          },
        },
      };
    });
    for await (const c of googleAdapter.streamText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    })) {
      void c;
    }
    expect(captured[0].generationConfig).not.toHaveProperty("thinkingConfig");
    expect(JSON.stringify(captured[0])).not.toContain("thinkingBudget");
  });

  it("telemetry reports control:null + applied:false", async () => {
    const { emitAiEvent } = await import("../../lib/ai/metrics/aiMetrics");
    const mockEmit = vi.mocked(emitAiEvent);
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "x" }] } }],
        usageMetadata: {},
      }),
    }));

    mockEmit.mockClear();
    await googleAdapter.generateText({
      messages: MESSAGES,
      options: { reasoning: { enabled: false } },
    });
    expect(mockEmit).toHaveBeenCalledWith("provider_reasoning_control", {
      provider: "google",
      model: "gemini-3.5-flash-lite",
      control: null,
      applied: false,
    });
  });

  it("catalog guard: no google model carries a reasoningControl", async () => {
    const { MODELS } = await import("../../lib/ai/providers/google/models");
    const marked = MODELS.filter((m) => m.reasoningControl != null);
    expect(marked).toHaveLength(0);
  });
});

describe("openrouter provider-native reasoning control (final catalog is unmarked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no catalog model receives a reasoning field", async () => {
    const captured = [];
    global.fetch = vi.fn(async (url, init = {}) => {
      captured.push(JSON.parse(init.body));
      return makeRes({
        status: 200,
        frames: ['{"choices":[{"delta":{"content":"x"}}]}', "[DONE]"],
      });
    });
    const { MODELS } = await import("../../lib/ai/providers/openrouter/models");
    for (const model of MODELS.map((m) => m.id)) {
      for await (const c of openrouterAdapter.streamText({
        messages: MESSAGES,
        model,
        options: { reasoning: { enabled: false } },
      })) {
        void c;
      }
      expect(captured.at(-1)).not.toHaveProperty("reasoning");
    }
  });

  it("catalog guard: no openrouter model carries a reasoningControl", async () => {
    const { MODELS } = await import("../../lib/ai/providers/openrouter/models");
    const marked = MODELS.filter((m) => m.reasoningControl != null);
    expect(marked).toHaveLength(0);
  });
});

afterAll(() => {
  global.fetch = originalFetch;
  if (originalKeys.groq === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKeys.groq;
  if (originalKeys.openrouter === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKeys.openrouter;
});
