import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AiError, AiErrorCode } from "../../lib/ai/types/errors";

vi.mock("../../lib/ai/metrics/aiMetrics", () => ({
  emitAiEvent: vi.fn(),
  emitAiRun: vi.fn(),
  emitCacheEvent: vi.fn(),
  emitBudgetEvent: vi.fn(),
  emitBreakerEvent: vi.fn(),
}));

import { runTask } from "../../lib/ai/executors/taskRunner";
import {
  registerProvider,
  clearProviders,
} from "../../lib/ai/providers/registry";
import { resetAll as resetBreaker } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { makeFakeProvider } from "./helpers/fakeProvider";
import { emitAiEvent, emitBreakerEvent } from "../../lib/ai/metrics/aiMetrics";

const EVENTS = () => emitAiEvent.mock.calls.map(([name, fields]) => ({ name, fields }));

function failingStreamAdapter(id, error) {
  const adapter = makeFakeProvider({ id });
  adapter.streamText = async function* () {
    throw error;
  };
  return adapter;
}

function okStreamAdapter(id, chunks) {
  const adapter = makeFakeProvider({ id });
  adapter.streamText = async function* () {
    for (const chunk of chunks) yield chunk;
  };
  return adapter;
}

async function collect(generator) {
  const out = [];
  for await (const chunk of generator) out.push(chunk);
  return out;
}

const ENV_BAK = { ...process.env };

describe("taskRunner stream fallback - pre-first-chunk failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProviders();
    resetBreaker();
    process.env.AI_PROVIDER_ORDER = "p1,p2";
    delete process.env.AI_PROVIDER_DISABLED;
    reloadAiEnv();
  });

  afterEach(() => {
    for (const key of Object.keys(ENV_BAK)) {
      if (ENV_BAK[key] === undefined) delete process.env[key];
      else process.env[key] = ENV_BAK[key];
    }
    reloadAiEnv();
    vi.useRealTimers();
  });

  it("falls back to the next provider when provider 1 fails before the first chunk (HTTP 404 shape)", async () => {
    registerProvider(
      failingStreamAdapter(
        "p1",
        new AiError(AiErrorCode.BAD_RESPONSE, "Gemini HTTP 404: model not found", { status: 404 })
      )
    );
    registerProvider(
      okStreamAdapter("p2", [
        { provider: "p2", model: "fake-model", text: "first " },
        { provider: "p2", model: "fake-model", text: "second" },
      ])
    );

    const generator = await runTask({
      type: "stream",
      feature: "ai-assist",
      messages: [{ role: "user", content: "hi" }],
    });
    const chunks = await collect(generator);

    expect(chunks.map((c) => c.text).join("")).toBe("first second");
    expect(chunks.every((c) => c.provider === "p2")).toBe(true);

    const events = EVENTS();
    const attempts = events.filter((e) => e.name === "provider_attempt");
    expect(attempts.map((e) => e.fields.provider)).toEqual(["p1", "p2"]);
    expect(attempts[1].fields.fallbackIndex).toBe(1);
    const fallback = events.find((e) => e.name === "provider_fallback");
    expect(fallback.fields.fromProvider).toBe("p1");
    expect(fallback.fields.toProvider).toBe("p2");
    const final = events.find((e) => e.name === "provider_final");
    expect(final.fields.status).toBe("ok");
    expect(final.fields.usedFallback).toBe(true);
    expect(emitBreakerEvent).toHaveBeenCalledWith(
      "failure",
      expect.objectContaining({ provider: "p1" })
    );
  });

  it("retries a retryable stream-start failure (429) before falling back", async () => {
    vi.useFakeTimers();
    registerProvider(
      failingStreamAdapter("p1", new AiError(AiErrorCode.RATE_LIMITED, "Rate limited", { status: 429 }))
    );
    registerProvider(
      okStreamAdapter("p2", [{ provider: "p2", model: "fake-model", text: "ok" }])
    );

    // runTask blocks on retry backoff sleeps - advance fake timers while it runs.
    const runPromise = runTask({
      type: "stream",
      feature: "ai-assist",
      messages: [{ role: "user", content: "hi" }],
    });
    await vi.advanceTimersByTimeAsync(15_000);
    const chunks = await collect(await runPromise);

    expect(chunks.map((c) => c.text).join("")).toBe("ok");
    const events = EVENTS();
    const p1Attempts = events.filter(
      (e) => e.name === "provider_attempt" && e.fields.provider === "p1"
    );
    expect(p1Attempts.length).toBeGreaterThanOrEqual(2);
    expect(events.filter((e) => e.name === "retry").length).toBeGreaterThanOrEqual(1);
    const fallback = events.find((e) => e.name === "provider_fallback");
    expect(fallback.fields.fromProvider).toBe("p1");
    expect(finalUsedFallback()).toBe(true);
    // Breaker accounting: ONE failure per provider after retry exhaustion -
    // individual retry attempts do not multi-count.
    const p1Failures = emitBreakerEvent.mock.calls.filter(
      ([name, fields]) => name === "failure" && fields.provider === "p1"
    );
    expect(p1Failures).toHaveLength(1);
  });

  it("both providers 429 at stream start -> final error carries RATE_LIMITED after retry exhaustion", async () => {
    vi.useFakeTimers();
    registerProvider(
      failingStreamAdapter("p1", new AiError(AiErrorCode.RATE_LIMITED, "Rate limited", { status: 429 }))
    );
    registerProvider(
      failingStreamAdapter("p2", new AiError(AiErrorCode.RATE_LIMITED, "Rate limited", { status: 429 }))
    );

    const runPromise = runTask({
      type: "stream",
      feature: "ai-assist",
      messages: [{ role: "user", content: "hi" }],
    });
    runPromise.catch(() => {}); // expected rejection
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(runPromise).rejects.toMatchObject({
      code: AiErrorCode.RATE_LIMITED,
    });
    // One breaker failure per provider (retry attempts do not multi-count).
    for (const pid of ["p1", "p2"]) {
      const failures = emitBreakerEvent.mock.calls.filter(
        ([name, fields]) => name === "failure" && fields.provider === pid
      );
      expect(failures).toHaveLength(1);
    }
  });

  it("treats an empty stream (done before first chunk) as a successful empty result", async () => {
    registerProvider(okStreamAdapter("p1", []));
    registerProvider(
      okStreamAdapter("p2", [{ provider: "p2", model: "fake-model", text: "should-not-run" }])
    );

    const generator = await runTask({
      type: "stream",
      feature: "ai-assist",
      messages: [{ role: "user", content: "hi" }],
    });
    const chunks = await collect(generator);

    expect(chunks).toEqual([]);
    const final = EVENTS().find((e) => e.name === "provider_final");
    expect(final.fields.status).toBe("ok");
    expect(final.fields.usedFallback).toBe(false);
  });

  it("does NOT fall back after the first chunk was produced (post-first-chunk failure surfaces to the consumer)", async () => {
    const adapter = makeFakeProvider({ id: "p1" });
    adapter.streamText = async function* () {
      yield { provider: "p1", model: "fake-model", text: "partial answer" };
      throw new AiError(AiErrorCode.BAD_RESPONSE, "mid-stream connection reset", { status: 500 });
    };
    registerProvider(adapter);
    registerProvider(
      okStreamAdapter("p2", [{ provider: "p2", model: "fake-model", text: "duplicate-other-provider" }])
    );

    const generator = await runTask({
      type: "stream",
      feature: "ai-assist",
      messages: [{ role: "user", content: "hi" }],
    });

    const chunks = [];
    await expect(async () => {
      for await (const chunk of generator) chunks.push(chunk);
    }).rejects.toMatchObject({ code: AiErrorCode.BAD_RESPONSE });

    expect(chunks).toEqual([{ provider: "p1", model: "fake-model", text: "partial answer" }]);
    const events = EVENTS();
    expect(events.filter((e) => e.name === "provider_attempt")).toHaveLength(1);
    expect(events.find((e) => e.name === "provider_fallback")).toBeUndefined();
    const final = events.find((e) => e.name === "provider_final");
    expect(final.fields.status).toBe("ok");
  });
});

function finalUsedFallback() {
  const final = EVENTS().find((e) => e.name === "provider_final");
  return final ? final.fields.usedFallback : null;
}
