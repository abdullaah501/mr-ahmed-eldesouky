/**
 * @typedef {Object} ProviderCapabilities
 *   Static capability flags declared per provider adapter. Read-only metadata
 *   used by the selector; never discovered by calling the model at runtime.
 * @property {boolean} [files]
 * @property {boolean} [pdf]
 * @property {boolean} [word]
 * @property {boolean} [images]
 * @property {boolean} [jsonMode]
 * @property {boolean} [structuredOutput]
 * @property {boolean} [streaming]
 * @property {boolean} [tools]
 * @property {boolean} [longContext]
 * @property {boolean} [vision]
 * @property {boolean} [reasoning]
 */

/**
 * @typedef {Object} ProviderModelEntry
 * @property {string} id
 * @property {Partial<ProviderCapabilities>} [capabilities]  per-model overrides
 * @property {number} [contextWindow]
 * @property {number} [maxOutputTokens]
 * @property {{ inputPer1M?: number, outputPer1M?: number } | null} [pricing]
 */

/**
 * @typedef {Object} Usage
 * @property {number} [promptTokens]
 * @property {number} [completionTokens]
 * @property {number} [totalTokens]
 */

/**
 * @typedef {Object} ProviderResult
 * @property {string}      provider
 * @property {string}      model
 * @property {object}      [object]     parsed structured object
 * @property {string}      [text]
 * @property {Usage}       [usage]
 * @property {number}      [estimatedCost]
 * @property {number}      [retries]
 * @property {number}      [cachedOn]
 * @property {*}           [raw]
 */

/**
 * @typedef {Object} RuntimeCapabilityFlags
 *   Live state used to skip providers before any network call.
 * @property {boolean} healthy
 * @property {boolean} disabled
 * @property {boolean} cooldown
 * @property {boolean} circuitOpen
 * @property {boolean} quotaAvailable
 * @property {boolean} budgetAvailable
 * @property {number}  estimatedLatencyMs
 * @property {boolean} available   AND of all the above gates
 */

/**
 * @typedef {Object} ProviderAdapter
 *   Pure adapter contract. Core never references a provider id by name.
 * @property {string} id
 * @property {string} label
 * @property {ProviderCapabilities} capabilities
 * @property {ProviderModelEntry[]} [models]
 * @property {(capability: string, opts?: {model?: string}) => boolean} supports
 * @property {(input: object) => Promise<ProviderResult>} generateText
 * @property {(input: object) => Promise<ProviderResult>} generateObject
 * @property {(input: object) => AsyncIterable<*>}        streamText
 * @property {(input: object) => Promise<ProviderResult>} extract
 * @property {(input: { usage: Usage, model?: string }) => number | null} estimateCost
 * @property {(input: { text: string, model?: string }) => number}        countTokens
 */

export {};