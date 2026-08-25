// Who is allowed to call, and who did.
//
// The platform issues each service a task role, so a WebIdentity token's `sub`
// is the caller's role ARN. That ARN is the thing that decides. The token also
// carries the service name as a principal tag, which decides nothing but is
// what a person reads at speed when an allow-list entry is wrong.

/**
 * The set of role ARNs permitted to call, one per allowed service name.
 *
 * @param {object} options
 * @param {string[]} options.allowedCallers Service names, as configured.
 * @param {string} options.awsAccount The AWS account the roles live in.
 * @returns {Set<string>} Acceptable token subjects.
 */
export function allowedSubjects({ allowedCallers, awsAccount }) {
  return new Set(
    allowedCallers
      .map((name) => name.trim())
      .filter((name) => name !== '')
      .map((name) => `arn:aws:iam::${awsAccount}:role/${name}`)
  )
}

/**
 * Whether a verified token's subject is one of the allowed callers.
 *
 * @param {Set<string>} subjects From {@link allowedSubjects}.
 * @param {string} [subject] The token's `sub` claim.
 * @returns {boolean} True when the caller is on the list.
 */
export function isAllowedCaller(subjects, subject) {
  return typeof subject === 'string' && subjects.has(subject)
}

const STS_CLAIM = 'https://sts.amazonaws.com/'

/**
 * The caller's service name, from the STS principal tags. For logging only —
 * a tag is not proof of anything, the subject is.
 *
 * @param {object} [payload] A verified token payload.
 * @returns {string|null} The ServiceName tag, or null when absent.
 */
export function callerServiceName(payload) {
  const tag = payload?.[STS_CLAIM]?.principal_tags?.ServiceName

  if (Array.isArray(tag)) {
    return typeof tag[0] === 'string' ? tag[0] : null
  }

  return typeof tag === 'string' ? tag : null
}
