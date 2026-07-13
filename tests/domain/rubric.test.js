import {
  CRITERIA,
  CRITERION_KEYS,
  RAG_VALUES,
  ROUTING_VALUES
} from '#/domain/rubric.js'

describe('#domain/rubric', () => {
  test('has exactly eight criteria', () => {
    expect(CRITERIA).toHaveLength(8)
  })

  test('criterion keys are unique', () => {
    const keys = CRITERIA.map((criterion) => criterion.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('every criterion defines red, amber, green bands', () => {
    for (const criterion of CRITERIA) {
      expect(typeof criterion.red).toBe('string')
      expect(typeof criterion.amber).toBe('string')
      expect(typeof criterion.green).toBe('string')
      expect(criterion.red.trim().length).toBeGreaterThan(0)
      expect(criterion.amber.trim().length).toBeGreaterThan(0)
      expect(criterion.green.trim().length).toBeGreaterThan(0)
    }
  })

  test('CRITERION_KEYS is derived from CRITERIA in order', () => {
    expect(CRITERION_KEYS).toEqual(CRITERIA.map((criterion) => criterion.key))
  })

  test('RAG values are fixed and ordered', () => {
    expect(RAG_VALUES).toEqual(['red', 'amber', 'green'])
  })

  test('routing values are fixed', () => {
    expect(ROUTING_VALUES).toEqual([
      'recommended_pattern',
      'hands_on_session',
      'referral_other_team',
      'refer_ai_unit'
    ])
  })
})
