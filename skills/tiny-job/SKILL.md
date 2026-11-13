---
name: tiny-job
description: Use only for a tiny change to code that already exists - one place plus its test, with no open choice - such as a different value, a rename, a changed condition, or a bug whose cause is already known ("change the tax rate to 20%", "rename X to Y", "make it say Z"). Runs the whole chain in one pass. Never for a new feature, function, file or endpoint - those start with brainstorming.
effort: low
---

# Tiny Job

One short pass through the whole chain: design, plan, test first, change, verify, review, finish. Do every step, write one line for each, and do not stop for approval.

Announce: "Using tiny-job: design, plan, test first, change, verify, review, finish."

1. **Design.** Read the code the change touches and every place it must reach: callers, tests, fixtures, config. Say in one line what you understood and the one sensible way to do it, with any assumption.
   - An open choice, a second place to change besides the test, or something new to build (a function, feature, file or endpoint)? This is not a tiny job. Say so in one line and load just-enough:brainstorming.
   - A bug whose cause you do not know? Load just-enough:systematic-debugging.
2. **Plan.** One line:
   `Plan: change TAX_RATE to 0.2 in cart.js:1 (reuse: the existing constant, ~1 line) -> test: total of 100 is 120 -> check: npm test`
3. **Test first.** Write or update one small test. Run it. Watch it fail for the right reason: the behavior is missing, not a typo in the test.
   - No logic a test can check (text, docs, settings, styling)? Ask: "This change has no logic to test. Skip the test?" and wait.
4. **Change.** The least code that passes: reuse what the codebase has, keep its style, touch nothing else.
5. **Verify.** Run the test, then the whole suite. State the result with the numbers the command printed. Never "should work".
6. **Review.** Read your own diff once for a bug, a risk, a missing test, and code that should not exist. One line: `Self-review: <what you found, or nothing found>`. Fix a real problem with a failing test first.
7. **Finish.** On `main` or `master`, leave the change uncommitted, say so, and offer to commit. On a branch, commit.

End with one line: what you skipped or did not check, and any risk.
