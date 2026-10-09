import { describe, it, expect, beforeEach } from "vitest";
import { select, requireOne } from "../../lib/ai/core/providerSelector";
import { clearProviders, registerProvider } from "../../lib/ai/providers/registry";
import { resetAll, trip } from "../../lib/ai/core/circuitBreaker";
import { reloadAiEnv } from "../../lib/ai/config/env";
import { runtimeFlags } from "../../lib/ai/capabilities/runtimeCapabilities";
import { makeFakeProvider } from "./helpers/fakeProvider";

function fake(id, opts) {
  return makeFakeProvider({ id, ...opts });
}

beforeEach(() => {
  clearProviders();
  resetAll();
  delete process.env.AI_PROVIDER_ORDER;
  delete process.env.AI_PROVIDER_DISABLED;
  delete process.env.AI_BUDGET_GLOBAL_MONTHLY;
  reloadAiEnv();
});

describe("runtimeCapabilities", () => {
  it("healthy closed provider is available", () => {
    const flags = runtimeFlags(fake("p"));
    expect(flags.available).toBe(true);
    expect(flags.healthy).toBe(true);
  });

  it("disabled provider is unavailable", () => {
    const flags = runtimeFlags(fake("p"), { disabledSet: new Set(["p"]) });
    expect(flags.disabled).toBe(true);
    expect(flags.available).toBe(false);
  });

  it("open circuit provider is unavailable", () => {
    const p = fake("p");
    trip("p", { cooldownMs: 60_000 });
    const flags = runtimeFlags(p);
    expect(flags.circuitOpen).toBe(true);
    expect(flags.cooldown).toBe(true);
    expect(flags.available).toBe(false);
  });
});

describe("providerSelector", () => {
  it("returns candidates ordered by AI_PROVIDER_ORDER", () => {
    let a, b, c;
    a = fake("a");
    b = fake("b");
    c = fake("c");
    registerProvider(a);
    registerProvider(b);
    registerProvider(c);
    process.env.AI_PROVIDER_ORDER = "c,a,b";
    reloadAiEnv();

    const { candidates } = select({ require: [] });
    expect(candidates[0].id).toBe("c");
    expect(candidates[1].id).toBe("a");
    expect(candidates[2].id).toBe("b");
  });

  it("unconfigured providers (no api key) are skipped", () => {
    const p = fake("p");
    p.apiKey = () => "";
    registerProvider(p);
    expect(select({}).candidates).toHaveLength(0);
  });

  it("disabled providers appear in skipped", () => {
    const p = fake("p");
    registerProvider(p);
    process.env.AI_PROVIDER_DISABLED = "p";
    reloadAiEnv();
    const { candidates, skipped } = select({});
    expect(candidates).toHaveLength(0);
    expect(skipped[0].reasons).toContain("disabled");
  });

  it("filters by required capability", () => {
    const textOnly = fake("text");
    textOnly.capabilities.vision = false;
    const vision = fake("vision");
    vision.capabilities.vision = true;
    registerProvider(textOnly);
    registerProvider(vision);
    process.env.AI_PROVIDER_ORDER = "text,vision";
    reloadAiEnv();

    const { candidates } = select({ require: ["vision"] });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("vision");
  });

  it("open circuit providers are skipped", () => {
    const p = fake("p");
    registerProvider(p);
    trip("p", { cooldownMs: 60_000 });
    const { candidates, skipped } = select({});
    expect(candidates).toHaveLength(0);
    expect(skipped[0].reasons).toContain("circuit-open");
  });

  it("requireOne throws NO_CONFIGURED_PROVIDER when none configured", () => {
    expect(() => requireOne({})).toThrow();
  });

  it("not-implemented adapters are skipped", () => {
    const p = fake("p");
    p.implemented = false;
    registerProvider(p);
    const { candidates, skipped } = select({});
    expect(candidates).toHaveLength(0);
    expect(skipped[0].reasons).toContain("not-implemented");
  });
});