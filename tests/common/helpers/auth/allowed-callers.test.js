import { describe, expect, test } from 'vitest'

import {
  allowedSubjects,
  callerServiceName,
  isAllowedCaller
} from '#/common/helpers/auth/allowed-callers.js'

const awsAccount = '123456789012'

describe('#allowedSubjects', () => {
  test('turns each service name into its role ARN', () => {
    const subjects = allowedSubjects({
      allowedCallers: ['service-manual-ui', 'aice-triage-frontend'],
      awsAccount
    })

    expect([...subjects]).toEqual([
      'arn:aws:iam::123456789012:role/service-manual-ui',
      'arn:aws:iam::123456789012:role/aice-triage-frontend'
    ])
  })

  // convict splits AUTH_ALLOWED_CALLERS on commas and keeps the spaces.
  test('trims names and drops empty ones', () => {
    const subjects = allowedSubjects({
      allowedCallers: ['service-manual-ui', ' aice-triage-frontend', '', '  '],
      awsAccount
    })

    expect(subjects.size).toBe(2)
    expect(
      subjects.has('arn:aws:iam::123456789012:role/aice-triage-frontend')
    ).toBe(true)
  })

  test('an empty list allows nobody rather than everybody', () => {
    expect(allowedSubjects({ allowedCallers: [], awsAccount }).size).toBe(0)
  })
})

describe('#isAllowedCaller', () => {
  const subjects = allowedSubjects({
    allowedCallers: ['service-manual-ui'],
    awsAccount
  })

  test('accepts a subject on the list', () => {
    expect(
      isAllowedCaller(
        subjects,
        'arn:aws:iam::123456789012:role/service-manual-ui'
      )
    ).toBe(true)
  })

  test('rejects the same role in another account', () => {
    expect(
      isAllowedCaller(
        subjects,
        'arn:aws:iam::999999999999:role/service-manual-ui'
      )
    ).toBe(false)
  })

  test('rejects a token with no subject', () => {
    expect(isAllowedCaller(subjects, undefined)).toBe(false)
  })
})

describe('#callerServiceName', () => {
  test('reads the ServiceName principal tag', () => {
    expect(
      callerServiceName({
        'https://sts.amazonaws.com/': {
          principal_tags: { ServiceName: ['service-manual-ui'] }
        }
      })
    ).toBe('service-manual-ui')
  })

  test('accepts a bare string as well as a one-element array', () => {
    expect(
      callerServiceName({
        'https://sts.amazonaws.com/': {
          principal_tags: { ServiceName: 'service-manual-ui' }
        }
      })
    ).toBe('service-manual-ui')
  })

  test('returns null when the claim block or the tag is absent', () => {
    expect(callerServiceName({})).toBeNull()
    expect(callerServiceName({ 'https://sts.amazonaws.com/': {} })).toBeNull()
    expect(callerServiceName(undefined)).toBeNull()
  })
})
