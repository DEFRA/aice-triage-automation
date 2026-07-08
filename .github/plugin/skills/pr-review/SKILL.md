---
name: pr-review
description: Guide an onboarding developer through reviewing an existing pull request with structured checks, validation steps, and learning-focused feedback.
license: OGL-UK-3.0
---

# PR Review

Use this skill when reviewing an existing PR and you want a structured, high
signal review that also teaches the reviewer.

## Goal

Help the reviewer understand what changed, why it changed, how to test it, and
what engineering concepts are worth learning from it.

## Output format

Return six sections in this order:

1. **Review summary**
2. **Change understanding**
3. **Validation checklist**
4. **Findings table**
5. **Suggested review comments**
6. **Learning opportunities**

Use status markers in findings:

- ✅ **Good**
- ⚠️ **Attention**
- ❌ **Fix**
- 📚 **Study**

---

## 1. Build understanding before judging

Start by reconstructing:

- **Entry point**: where the change begins in code flow
- **Problem statement**: what issue the PR intends to solve
- **Solution path**: how control/data moves through updated modules
- **Behaviour shift**: what users or operators will observe differently

If intent is ambiguous, write **Needs clarification** instead of guessing.

---

## 2. Review by risk, not by file order

Prioritise checks in this sequence:

1. Correctness and regression risk
2. Security/PII and data handling
3. Validation and error paths
4. Architecture consistency
5. Test quality and coverage intent
6. Documentation accuracy

Avoid style-only comments unless they hide a correctness or maintenance risk.

---

## 3. Suggest concrete ways to exercise the PR

Provide runnable validation steps:

- Commands to run existing quality gates
- Happy-path behaviour checks
- Negative-path or boundary checks
- Data integrity checks (when persistence is involved)
- "What evidence would convince you this is correct?"

Prefer reproducible CLI/API steps over abstract advice.

---

## 4. Produce actionable findings

Create a findings table:

`item | area | status | why it matters | recommended action`

For each ⚠️, ❌, and 📚 finding include:

- The affected file(s)
- The specific risk
- A suggested fix or follow-up action

---

## 5. Draft reviewer comments

Write concise, copy-ready comments a reviewer can post on the PR:

- Ask clarifying questions where intent is unclear
- Suggest safer alternatives when risk is high
- Acknowledge strong patterns worth keeping

Keep comments factual and specific; avoid vague language.

---

## 6. Teach while reviewing

List 2–4 concepts demonstrated by the PR and explain:

- **What the concept is**
- **How this PR uses it**
- **A common mistake to avoid**
- **A next file/doc to study in this repo**

Examples: Joi schema boundaries, request lifecycle in plugins, route/service
separation, defensive logging without PII, test design for failure paths.

---

## Defra and repo alignment

- Invoke `defra-quality-gates` when evaluating whether evidence is sufficient.
- Invoke `defra-security-pii` for any data-handling or logging concerns.
- Align feedback with `docs/coding-standards.md`,
  `docs/architecture.md`, and `.github/copilot-instructions.md`.
