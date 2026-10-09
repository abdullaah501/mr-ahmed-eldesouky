import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/memcachedClient", () => ({
  getMemcachedClient: vi.fn(),
}));

import { getMemcachedClient } from "../lib/memcachedClient";
import { createMemcachedAdapter } from "../lib/storage/MemcachedAdapter";

function makeMockClient() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => {
      const entry = store.get(key);
      if (!entry) return { value: null };
      if (entry.expires && Date.now() > entry.expires) {
        store.delete(key);
        return { value: null };
      }
      return { value: entry.value };
    }),
    set: vi.fn(async (key, value, options) => {
      store.set(key, {
        value,
        expires: options?.expires
          ? Date.now() + options.expires * 1000
          : null,
      });
    }),
    add: vi.fn(async (key, value, options) => {
      if (store.has(key)) return false;
      store.set(key, {
        value,
        expires: options?.expires
          ? Date.now() + options.expires * 1000
          : null,
      });
      return true;
    }),
    delete: vi.fn(async (key) => {
      store.delete(key);
    }),
    increment: vi.fn((key, amount, _options, callback) => {
      const entry = store.get(key);
      if (!entry || entry.value === null || entry.value === undefined) {
        return callback(null, false, null);
      }
      const current = parseInt(entry.value, 10) || 0;
      const newVal = current + amount;
      entry.value = String(newVal);
      callback(null, true, newVal);
    }),
  };
}

describe("MemcachedAdapter C1: throw on null client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("set() throws when client is null", async () => {
    getMemcachedClient.mockReturnValue(null);
    const adapter = createMemcachedAdapter();
    await expect(adapter.set("key", "value")).rejects.toThrow(
      "Memcached client is not available"
    );
  });

  it("add() throws when client is null", async () => {
    getMemcachedClient.mockReturnValue(null);
    const adapter = createMemcachedAdapter();
    await expect(adapter.add("key", "value")).rejects.toThrow(
      "Memcached client is not available"
    );
  });

  it("get() returns null when client is null (fail-open)", async () => {
    getMemcachedClient.mockReturnValue(null);
    const adapter = createMemcachedAdapter();
    const result = await adapter.get("key");
    expect(result).toBeNull();
  });
});

describe("MemcachedAdapter add()", () => {
  let mockClient;
  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = makeMockClient();
    getMemcachedClient.mockReturnValue(mockClient);
    adapter = createMemcachedAdapter();
  });

  it("returns true when key does not exist", async () => {
    const result = await adapter.add("new-key", "value1");
    expect(result).toBe(true);
  });

  it("returns false when key already exists", async () => {
    await adapter.set("existing-key", "value1");
    const result = await adapter.add("existing-key", "value2");
    expect(result).toBe(false);
  });

  it("stores the value when key is added", async () => {
    await adapter.add("key", "stored-value");
    const val = await adapter.get("key");
    expect(val).toBe("stored-value");
  });
});

describe("MemcachedAdapter set() and get()", () => {
  let mockClient;
  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = makeMockClient();
    getMemcachedClient.mockReturnValue(mockClient);
    adapter = createMemcachedAdapter();
  });

  it("stores and retrieves a value", async () => {
    await adapter.set("key", "hello");
    const val = await adapter.get("key");
    expect(val).toBe("hello");
  });

  it("returns null for missing key", async () => {
    const val = await adapter.get("nonexistent");
    expect(val).toBeNull();
  });
});

describe("MemcachedAdapter increment()", () => {
  let mockClient;
  let adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = makeMockClient();
    getMemcachedClient.mockReturnValue(mockClient);
    adapter = createMemcachedAdapter();
  });

  it("sets value to amount when key does not exist via fallback", async () => {
    const result = await adapter.set("counter", "1");
    const incResult = await adapter.increment("counter", 1);
    expect(incResult).toBe(2);
  });
});
