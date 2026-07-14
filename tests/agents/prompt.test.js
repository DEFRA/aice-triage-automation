import { describe, test, expect } from 'vitest'

import { CRITERION_KEYS } from '#/domain/rubric.js'
import { SCORING_SYSTEM_PROMPT } from '#/agents/prompt.js'

describe('#agents/prompt', () => {
  test('AC3: prompt contains every criterion key', () => {
    for (const key of CRITERION_KEYS) {
      expect(SCORING_SYSTEM_PROMPT).toContain(key)
    }
  })
})
