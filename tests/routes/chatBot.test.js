import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ai: vi.fn(),
  checkRateLimit: vi.fn(),
  incrementRateLimit: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data, init = {}) => ({
      _data: data,
      status: init.status || 200,
      headers: init.headers || {},
    }),
  },
}));

vi.mock("../../lib/rateLimit", () => ({
  checkRateLimit: (...args) => mocks.checkRateLimit(...args),
  incrementRateLimit: (...args) => mocks.incrementRateLimit(...args),
}));

vi.mock("../../lib/ai/index", () => ({
  ai: (...args) => mocks.ai(...args),
}));

import { POST } from "../../src/app/api/ai/chat-bot/route";

const URL_BASE = "https://mr-mohamed-talaat.example";
const originalUrl = process.env.URL;

function makeReq({ message = "hello", origin = URL_BASE } = {}) {
  return {
    headers: {
      get: (key) => {
        if (key === "origin") return origin;
        if (key === "referer") return null;
        if (key === "x-forwarded-for") return "1.2.3.4";
        if (key === "cf-connecting-ip") return null;
        return null;
      },
    },
    json: async () => ({ message }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.URL = URL_BASE;
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.incrementRateLimit.mockResolvedValue(undefined);
  mocks.ai.mockResolvedValue({ text: "ok", provider: "google", model: "model-x" });
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env.URL;
  else process.env.URL = originalUrl;
});

describe("POST /api/ai/chat-bot", () => {
  it("uses the shared ai() platform without hardcoding provider or model", async () => {
    mocks.ai.mockResolvedValue({ text: "Desouky reply" });

    const res = await POST(makeReq({ message: "How do I study?" }));

    expect(res.status).toBe(200);
    expect(res._data).toEqual({ reply: "Desouky reply" });

    expect(mocks.ai).toHaveBeenCalledTimes(1);
    const task = mocks.ai.mock.calls[0][0];
    expect(task.type).toBe("text");
    expect(task.feature).toBe("chatbot");
    expect(task).not.toHaveProperty("model");
    expect(task).not.toHaveProperty("prefer");

    expect(task.messages[0].role).toBe("system");
    expect(task.messages[0].content).toContain("أحمد الدسوقي");
    expect(task.messages[0].content).not.toContain("Marian");
    expect(task.messages[0].content).not.toContain("mrs-marian.com");
    expect(task.messages[1]).toEqual({ role: "user", content: "How do I study?" });

    expect(mocks.incrementRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.incrementRateLimit).toHaveBeenCalledWith({
      service: "chatbot",
      key: `1.2.3.4:${new Date().toISOString().slice(0, 10)}`,
      windowSeconds: 86400,
    });
  });

  it("keeps the existing rate-limit request settings", async () => {
    await POST(makeReq());

    expect(mocks.checkRateLimit).toHaveBeenCalledWith({
      service: "chatbot",
      key: `1.2.3.4:${new Date().toISOString().slice(0, 10)}`,
      limit: 7,
      windowSeconds: 86400,
    });
  });

  it("returns the existing 500 error and skips the increment when ai() fails", async () => {
    mocks.ai.mockRejectedValue(new Error("provider down"));

    const res = await POST(makeReq());

    expect(res.status).toBe(500);
    expect(res._data).toEqual({ message: "Failed to fetch from OpenRouter." });
    expect(mocks.incrementRateLimit).not.toHaveBeenCalled();
  });

  it("keeps the existing 429 response when the rate limit is exceeded", async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false });

    const res = await POST(makeReq());

    expect(res.status).toBe(429);
    expect(res._data).toEqual({ message: "Rate limit exceeded." });
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.incrementRateLimit).not.toHaveBeenCalled();
  });

  it("keeps the existing 403 response for a foreign origin", async () => {
    const res = await POST(makeReq({ origin: "https://evil.example" }));

    expect(res.status).toBe(403);
    expect(res._data).toEqual({ message: "Unauthorized access." });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.ai).not.toHaveBeenCalled();
  });
});
