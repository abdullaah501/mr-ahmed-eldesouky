import { describe, it, expect, afterAll } from "vitest";
import { aiEnv, reloadAiEnv } from "../../lib/ai/config/env";

const ENV_BAK = { ...process.env };

function withEnv(vars) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return reloadAiEnv();
}

describe("AI_PROVIDER_ORDER / AI_PROVIDER_DISABLED parsing", () => {
  it("parses unquoted values unchanged (existing behavior)", () => {
    const env = withEnv({
      AI_PROVIDER_ORDER: "opencode,google,groq,openrouter",
      AI_PROVIDER_DISABLED: "opencode",
    });
    expect(env.order).toEqual(["opencode", "google", "groq", "openrouter"]);
    expect(env.disabled.has("opencode")).toBe(true);
    expect(env.disabled.has("google")).toBe(false);
  });

  it("parses double-quoted values to the same result", () => {
    const env = withEnv({
      AI_PROVIDER_ORDER: '"opencode,google,groq,openrouter"',
      AI_PROVIDER_DISABLED: '"opencode"',
    });
    expect(env.order).toEqual(["opencode", "google", "groq", "openrouter"]);
    expect(env.disabled.has("opencode")).toBe(true);
    expect(env.disabled.has('"opencode"')).toBe(false);
  });

  it("tolerates single quotes", () => {
    const env = withEnv({
      AI_PROVIDER_ORDER: "'google,groq'",
      AI_PROVIDER_DISABLED: "'groq'",
    });
    expect(env.order).toEqual(["google", "groq"]);
    expect(env.disabled.has("groq")).toBe(true);
  });

  it("keeps internal commas as separators and tolerates whitespace (whole-value quoting)", () => {
    const env = withEnv({ AI_PROVIDER_ORDER: '"b , a"' });
    expect(env.order).toEqual(["b", "a"]);
    const env2 = withEnv({ AI_PROVIDER_ORDER: "  b ,  c  " });
    expect(env2.order).toEqual(["b", "c"]);
  });

  it("falls back to defaults for empty values", () => {
    const env = withEnv({ AI_PROVIDER_ORDER: "", AI_PROVIDER_DISABLED: "" });
    expect(env.order.length).toBeGreaterThan(0);
    expect(env.disabled.size).toBe(0);
  });
});

afterAll(() => {
  for (const key of Object.keys(ENV_BAK)) {
    if (ENV_BAK[key] === undefined) delete process.env[key];
    else process.env[key] = ENV_BAK[key];
  }
  reloadAiEnv();
});
