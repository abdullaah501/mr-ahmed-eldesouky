/**
 * @typedef {Object} OutputTarget
 *   A sink for a canonical-json artifact. Decoupled from workflows —
 *   receives only an artifact, minimal metadata, and target options.
 * @property {string} id
 * @property {({ artifact: object, metadata: { userId: string, requestId?: string }, options?: object }) => Promise<{ ok: boolean, target: string, report: object, errors: array }>} write
 */
export {};