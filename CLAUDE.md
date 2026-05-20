# Solaryn — Rules for Claude

These rules apply to every task in this repository. They override any default behavior. Read them at session start and check them before each significant action.

---

## Rule 1 — Never hallucinate. Verify everything verifiable.

Do NOT make claims about code, file contents, API responses, env vars, deployed state, third-party docs, or user history that you have not directly verified in this session.

Concrete:
- Before referring to a function, file path, or variable: **grep or read it**.
- Before claiming an endpoint works: **curl it**.
- Before saying "X is deployed": **check `git log`, `git status`, or hit the live URL**.
- If a memory says "X exists", treat it as a hypothesis to verify, not a fact.
- When something is not verifiable (user intent, future behavior, business reasoning): say so explicitly with words like "I'm assuming…" or "not verified".

The cost of saying "I don't know, let me check" is small. The cost of confidently lying is high — it erodes trust and creates bad downstream decisions.

---

## Rule 2 — Plan, then reflect. No coding without a plan.

For any task more complex than a 1-line edit:

1. **State the goal in one sentence.** What should the outcome be? What does "done" look like?
2. **List the steps** required to reach that outcome.
3. **Identify the risks** — what could go wrong? what could be wrong about my plan?
4. **Ask the user if the goal/plan is ambiguous.** Do not assume — clarify.
5. **Execute the plan.**
6. **Reflect after execution.** Does the result match the stated goal? If not, fix it before claiming "done". Do not ship trash and call it complete.

If after reflection you realize the approach was wrong, **say so** and propose a corrected plan. Do not paper over mistakes.

---

## Rule 3 — Always read files before modifying or reasoning about them.

If a task requires understanding what's already there:
- **Read the file** (or grep it). Don't infer from filename or memory.
- For multi-file changes: read all affected files first, then edit.
- For bug investigation: read the actual code path, don't speculate from symptoms.

Exception: trivial new-file creation where no prior context matters.

If a file is too large to read fully, read the relevant sections explicitly. Never pretend to have read something you skimmed.

---

## Rule 4 — Maintain `SESSION.md` continuously.

This project must always have an up-to-date `SESSION.md` at the repo root that captures the current session's state, so if the conversation drops the next session can resume without starting from scratch.

**Update `SESSION.md` after every meaningful action**, not just at the end. "Meaningful" = anything that changes project state (file edit, deploy, env var, decision made, blocker hit).

### `SESSION.md` structure

```
# Session — <date>

## Active goal
<1-2 lines: what we're trying to accomplish right now>

## Status
<active / blocked / awaiting user / done>

## Done this session
- <bullet 1>
- <bullet 2>

## In progress
- <what's mid-flight, with file paths>

## Blockers / pending decisions
- <thing waiting on user, or known bug>

## Next step
<what to do when picking back up>

## Context the next session needs
- <env vars, IDs, secrets refs (no secret values), urls, links to commits>
- <key decisions made (with reasoning)>

## Open follow-ups (not blocking)
- <small things noted but not yet done>
```

Update timestamp + relevant section. Keep it concise — `SESSION.md` is not a transcript, it's a handoff doc.

---

## Operational reminders

- Do not skip these rules for "quick" tasks. Quick tasks are where hallucinations slip in unnoticed.
- If a user message contradicts a rule (e.g., "just go ahead and code"), follow the rule anyway — write a 3-line plan in the response before coding.
- When unsure between two valid approaches, surface the choice; don't pick silently.
