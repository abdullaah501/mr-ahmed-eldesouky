import { describe, it, expect, beforeEach } from "vitest";
import { registerProvider, clearProviders, listProviders, getProvider } from "../../lib/ai/providers/registry";
import { makeFakeProvider } from "./helpers/fakeProvider";

beforeEach(() => {
  clearProviders();
});

describe("providers registry", () => {
  it("registers and lists providers", () => {
    const p = makeFakeProvider({ id: "a" });
    registerProvider(p);
    expect(listProviders()).toHaveLength(1);
    expect(getProvider("a")).toBe(p);
  });

  it("rejects adapters missing required methods", () => {
    expect(() => registerProvider({ id: "x", label: "X", capabilities: {} })).toThrow();
  });

  it("rejects adapters with non-string id", () => {
    expect(() => registerProvider({ id: 5, label: "X", capabilities: {}, supports() {} })).toThrow();
  });

  it("supports() reads declared capabilities only", () => {
    const p = makeFakeProvider({ id: "a", supportsAll: false });
    p.capabilities.vision = true;
    expect(p.supports("vision")).toBe(true);
    p.capabilities.vision = false;
    expect(p.supports("vision")).toBe(false);
  });

  it("per-model capability override wins", () => {
    const p = makeFakeProvider({ id: "a" });
    p.capabilities.vision = false;
    p.models = [{ id: "vision-model", capabilities: { vision: true }, pricing: { inputPer1M: 0, outputPer1M: 0 } }];
    expect(p.supports("vision", { model: "vision-model" })).toBe(true);
    expect(p.supports("vision", { model: "other" })).toBe(false);
  });
});