/**
 * In-memory implementation of the StorageAdapter interface for testing.
 * The `add()` method is atomic: check-and-set happen in the same microtask
 * so concurrent calls with the same key always produce one winner.
 */
export class InMemoryStorage {
  constructor() {
    this._store = new Map();
    this._expiresAt = new Map();
  }

  async get(key) {
    this._purge();
    const val = this._store.get(key);
    return val !== undefined ? val : null;
  }

  async set(key, value, options = {}) {
    this._store.set(key, String(value));
    if (options.expires) {
      this._expiresAt.set(key, Date.now() + options.expires * 1000);
    }
  }

  async add(key, value, options = {}) {
    this._purge();
    if (this._store.has(key)) {
      return false;
    }
    this._store.set(key, String(value));
    if (options.expires) {
      this._expiresAt.set(key, Date.now() + options.expires * 1000);
    }
    return true;
  }

  async increment(key, amount = 1, options = {}) {
    // Perform read-modify-write synchronously (no intermediate awaits)
    // so that concurrent JS callers cannot interleave inside this method.
    this._purge();
    const initial = options.initial !== undefined ? options.initial : amount;
    const raw = this._store.get(key);
    let newVal;
    if (raw === undefined) {
      newVal = initial;
    } else {
      newVal = parseInt(raw, 10) + amount;
    }
    this._store.set(key, String(newVal));
    if (options.expires) {
      this._expiresAt.set(key, Date.now() + options.expires * 1000);
    }
    return newVal;
  }

  async delete(key) {
    this._store.delete(key);
    this._expiresAt.delete(key);
    return true;
  }

  _purge() {
    const now = Date.now();
    for (const [key, expiry] of this._expiresAt) {
      if (now >= expiry) {
        this._store.delete(key);
        this._expiresAt.delete(key);
      }
    }
  }
}
