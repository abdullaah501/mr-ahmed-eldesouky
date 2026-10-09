/**
 * @typedef {Object} NormalizedResource
 * @property {string}  [text]        extracted text (absent when provider files used natively)
 * @property {Buffer}  [nativeFile]  original file bytes kept for provider-native upload
 * @property {string}  [nativeFileMime]
 * @property {object}  metadata     { resourceKind, extractorId, sourceMime, sourceName, ... }
 * @property {Array}   [refs]       source references (page/paragraph) when available
 * @property {Array}   warnings
 */
export {};