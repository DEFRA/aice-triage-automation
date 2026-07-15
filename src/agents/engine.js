/**
 * @typedef {object} Engine
 * @property {string} name
 * @property {(text: string) => Promise<ScoringResult>} score
 * @property {(text: string) => Promise<Classification>} classify
 */

/**
 * @typedef {import('#/domain/scoring-schema.js').ScoringResult} ScoringResult
 */

/**
 * @typedef {import('#/domain/scoring-schema.js').Classification} Classification
 */
