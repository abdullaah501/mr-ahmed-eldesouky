import { describe, it, expect } from 'vitest';
import { listProviders } from '../../lib/ai/providers/registry';
import { staticProfile } from '../../lib/ai/capabilities/staticCapabilities';
import '../../lib/ai/providers';

describe('provider multi-model expansion', () => {
  it('google exposes exactly 5 models', () => {
    const p = listProviders().find((x) => x.id === 'google');
    expect(p).toBeTruthy();
    expect(p.models).toHaveLength(5);
    expect(p.models.map((m) => m.id)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
    ]);
  });

  it('groq exposes exactly 2 models', () => {
    const p = listProviders().find((x) => x.id === 'groq');
    expect(p).toBeTruthy();
    expect(p.models).toHaveLength(2);
    expect(p.models.map((m) => m.id)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  });

  it('openrouter exposes exactly 3 models', () => {
    const p = listProviders().find((x) => x.id === 'openrouter');
    expect(p).toBeTruthy();
    expect(p.models).toHaveLength(3);
    expect(p.models.map((m) => m.id)).toEqual([
      'liquid/lfm-2.5-2.6b:free',
      'cohere/north-mini-code:free',
      'poolside/laguna-s-2.1:free',
    ]);
  });

  it('opencode exposes exactly 3 models', () => {
    const p = listProviders().find((x) => x.id === 'opencode');
    expect(p).toBeTruthy();
    expect(p.models).toHaveLength(3);
    expect(p.models.map((m) => m.id)).toEqual(['mimo-v2.5-free', 'deepseek-v4-flash-free', 'ling-3.0-flash-free']);
  });
});

describe('default model selection', () => {
  it('google default is gemini-3.5-flash-lite', () => {
    const p = listProviders().find((x) => x.id === 'google');
    const def = p.models.find((m) => m.default);
    expect(def).toBeTruthy();
    expect(def.id).toBe('gemini-3.5-flash-lite');
  });

  it('groq default is openai/gpt-oss-120b', () => {
    const p = listProviders().find((x) => x.id === 'groq');
    const def = p.models.find((m) => m.default);
    expect(def.id).toBe('openai/gpt-oss-120b');
  });

  it('openrouter default is liquid/lfm-2.5-2.6b:free', () => {
    const p = listProviders().find((x) => x.id === 'openrouter');
    expect(p.models.find((m) => m.default).id).toBe('liquid/lfm-2.5-2.6b:free');
  });

  it('opencode default is mimo-v2.5-free', () => {
    const p = listProviders().find((x) => x.id === 'opencode');
    expect(p.models.find((m) => m.default).id).toBe('mimo-v2.5-free');
  });
});

describe('supports(capability, {model})', () => {
  it('google vision supported on default model', () => {
    const p = listProviders().find((x) => x.id === 'google');
    expect(p.supports('vision', { model: 'gemini-3.5-flash-lite' })).toBe(true);
  });

  it('groq vision is unsupported on the gpt-oss models', () => {
    const p = listProviders().find((x) => x.id === 'groq');
    expect(p.supports('vision', { model: 'openai/gpt-oss-120b' })).toBe(false);
    expect(p.supports('vision', { model: 'openai/gpt-oss-20b' })).toBe(false);
  });

  it('openrouter vision differs between models', () => {
    const p = listProviders().find((x) => x.id === 'openrouter');
    expect(p.supports('vision', { model: 'liquid/lfm-2.5-2.6b:free' })).toBe(false);
    expect(p.supports('vision', { model: 'cohere/north-mini-code:free' })).toBe(false);
    expect(p.supports('vision', { model: 'poolside/laguna-s-2.1:free' })).toBe(true);
  });
});

describe('countTokens behaviour unchanged', () => {
  it('countTokens works the same for any model (heuristic)', () => {
    const p = listProviders().find((x) => x.id === 'google');
    const n = p.countTokens({ text: 'hello world' });
    expect(typeof n).toBe('number');
    expect(n).toBeGreaterThan(0);
  });
});

describe('provider static profile', () => {
  it('google staticProfile for default model equals provider-level capabilities', () => {
    const p = listProviders().find((x) => x.id === 'google');
    const profile = staticProfile(p, { model: 'gemini-3.5-flash-lite' });
    expect(profile.vision).toBe(true);
    expect(profile.files).toBe(true);
    expect(profile.pdf).toBe(true);
  });
});
