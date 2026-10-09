/**
 * StorageAdapter interface
 *
 * @typedef {Object} StorageAdapter
 * @property {(key: string) => Promise<string|null>} get
 *   Retrieve a value by key. Returns the string value or null if not found or on failure.
 *
 * @property {(key: string, value: string, options?: { expires?: number }) => Promise<void>} set
 *   Store a value with optional TTL in seconds. Throws if the storage backend is unavailable.
 *
 * @property {(key: string, value: string, options?: { expires?: number }) => Promise<boolean>} add
 *   Atomically store a value only if the key does not already exist.
 *   Returns true if stored, false if key already exists or on failure.
 *   Throws if the storage backend is unavailable.
 *
 * @property {(key: string, amount?: number, options?: { initial?: number, expires?: number }) => Promise<number|null>} increment
 *   Atomically increment a key by `amount`. If the key does not exist, create it
 *   with value `initial` (default 0) before incrementing. Returns the new value,
 *   or null if the operation cannot be performed.
 *
 * @property {(key: string) => Promise<boolean>} delete
 *   Delete a key. Returns true if the key existed and was deleted.
 */

export {};
