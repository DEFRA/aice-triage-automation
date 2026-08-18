import { CRITERIA } from '#/domain/rubric.js'

/**
 * Deterministic engine, no network. Exercises the pipeline, routing,
 * validation and error paths without calling a hosted AI model.
 * Heuristics are placeholders, not real judgement.
 * @returns {import('./engine.js').Engine}
 */
export function createStubEngine() {
  return {
    name: 'stub',

    async score(text) {
      const governance =
        /governance|policy|approval|freedom of information|licen[sc]e/i.test(
          text
        )

      const evidence = (
        text
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('Problem:'))
          ?.replace('Problem: ', '') ??
        text.trim().split('\n')[0] ??
        ''
      ).slice(0, 200)

      const criteria = Object.fromEntries(
        CRITERIA.map((criterion) => [
          criterion.key,
          {
            rag: 'amber',
            rubric_band_cited: criterion.amber,
            evidence_quoted: evidence,
            explanation: `Stub: placeholder amber rating for ${criterion.name}.`,
            missing_evidence: criterion.key === 'business_value'
          }
        ])
      )

      return {
        criteria,
        routing_recommendation: governance
          ? 'refer_ai_unit'
          : 'hands_on_session',
        // Neither routing the stub returns is recommended_pattern, so this stays
        // empty. It must, or the result fails its own schema.
        pattern_cited: '',
        flags: {
          governance_required: governance,
          low_confidence: false
        }
      }
    },

    async classify(text) {
      const emailCount = (text.match(/@[\w.-]+\.[a-z]{2,}/gi) ?? []).length
      const wantsTooling =
        /\bcopilot\b/i.test(text) && /(licen[sc]e|access)/i.test(text)
      const isAccessRequest = wantsTooling && emailCount >= 2

      // A use case names something wrong in the world: a delay, a manual step, a
      // backlog. An enquiry asks about the rules instead. That is the line the
      // stub draws, rather than looking for stock phrases — real submitters do
      // not write "the problem is", they write "the problem still occurs", and a
      // heuristic tuned to set wording misses the submissions it exists to catch.
      const describesWork =
        /\b(problems?|issues?|delays?|frustration|bottleneck|backlog|workload|manual|process(es|ing|ed)?|we (want|would like|need)|our team|users? (are|would))\b/i.test(
          text
        )
      // Narrower than "contains a question mark". Intake submissions arrive with
      // the form's own headings ("What is the problem?"), so the mark alone says
      // nothing about whether the submitter is asking anything.
      const asksQuestion =
        /\?/.test(text) &&
        /(allowed|permitted|sign-?post|does this mean|guidance|position on|compare notes|have a call)/i.test(
          text
        )
      // describesWork wins over asksQuestion, because an opportunity wrongly
      // called an enquiry is never scored and nobody sees a grid that looks
      // wrong — the same asymmetry the real classifier is told about.
      const isEnquiry = asksQuestion && !describesWork

      // Access requests are checked first, so they win when a submission trips
      // both signals — a licence ask for named people wrapped in a question
      // about the rules. Answering the question alone leaves those people
      // without the tool they asked for, whereas granting access answers both.
      if (isAccessRequest) {
        return {
          kind: 'access_request',
          reason:
            'Asks for tool licences or access for a named team (stub heuristic).'
        }
      }
      if (isEnquiry) {
        return {
          kind: 'enquiry',
          reason:
            'Asks a question rather than describing a problem to solve (stub heuristic).'
        }
      }
      return {
        kind: 'opportunity',
        reason: 'Describes an AI use case to triage (stub heuristic).'
      }
    }
  }
}
