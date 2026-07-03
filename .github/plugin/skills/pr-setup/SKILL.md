---
name: pr-setup
description: Help an onboarding developer prepare a high-quality pull request with a clear narrative, test evidence, reviewer guidance, and learning notes.
license: OGL-UK-3.0
---

# PR Setup

Use this skill when a change is ready to be proposed and the author needs help
opening a strong pull request.

## Goal

Produce a PR draft that is easy to review and teaches the author how to explain
their work well.

## Output format

Return five sections in this order:

1. **PR title candidates** (3 options, Conventional Commit style)
2. **PR description draft**
3. **Reviewer checklist**
4. **How to exercise the change**
5. **Learning notes**

---

## 1. Build the change narrative first

Before writing the PR text, reconstruct the story:

- **Where it started**: what ticket, incident, or user pain triggered it
- **Problem being solved**: current behaviour and why it is not acceptable
- **How it is addressed**: implementation approach and key trade-offs
- **Scope boundaries**: what is intentionally not changed

If any item is unclear, state an explicit assumption and mark it as
**Needs confirmation**.

---

## 2. Write a reviewable PR description

Generate a PR description with these headings:

- **Why**
- **What changed**
- **How to review**
- **How to test**
- **Risks and mitigations**
- **Out of scope**

Rules:

- Keep statements concrete and tied to files/modules
- Name behavioural changes explicitly
- Call out migrations, config changes, and backward-compatibility impact
- If docs were updated, list exactly which docs and why

---

## 3. Provide an actionable reviewer checklist

Create a checklist that helps reviewers verify behaviour, not style:

- Problem statement in PR matches code changes
- Route/service/layering still follows project architecture
- Validation/error handling follows existing patterns
- Security and PII expectations are respected
- Tests cover happy path and failure modes introduced by the change
- Documentation is accurate for changed behaviour

Prefer checkboxes with file-specific pointers where possible.

---

## 4. Recommend how to exercise the change

Give concrete, copy-pasteable steps for a reviewer to run locally:

- Setup prerequisites (if any)
- Commands to run for quality gates
- Endpoint or user-flow checks for happy path
- At least one negative/edge-case check
- Evidence to capture in PR comments (logs, output snippets, screenshots when relevant)

Use existing project scripts and commands only.

---

## 5. Add onboarding developer learning notes

Call out 2–4 concepts used by this change and why they matter here, for example:

- Joi validation design
- Thin-route/service separation
- Convict-based configuration
- Mongo lock usage patterns
- Error summary and GOV.UK accessibility patterns

For each concept include:

- **What to read in this repo** (specific file or section)
- **Why this technique is used**
- **What can go wrong if misapplied**

End with a short **Next learning step** list (1–3 items).

---

## Defra and repo alignment

- Invoke `defra-quality-gates` when preparing exercise/test guidance.
- Invoke `defra-security-pii` if the change touches user content, logs, or data handling.
- Keep branch/commit recommendations aligned with `defra-branching` and
  `defra-commit-messages`.
