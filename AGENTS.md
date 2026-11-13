# just-enough: notes for agents working on this repo

just-enough is a fork of Superpowers with the rules of Ponytail and the Karpathy guidelines folded into every skill. Read this before you change anything here.

- **Skills are behavior-shaping code.** Change them with `just-enough:writing-skills`: watch the agent's behavior before and after, and keep each change small.
- **Keep each `SKILL.md` under 20,000 bytes** (`tests/skill-size`). Material a skill needs only sometimes goes in its `references/`.
- **Keep `tiny-job` short.** It runs the whole chain in one pass for small changes, so every word in it is read on every small change.
- **Keep the just-enough rules** in `skills/using-just-enough/SKILL.md` short: they load at the start of every session.
- **A new harness must load the `using-just-enough` bootstrap at session start.** Acceptance test: in a clean session, the message "Let's make a react todo list" must trigger `brainstorming` before any code is written.
- **Run the tests for what you touched** before opening a PR: the matching `tests/` scripts, `claude plugin test .` for the meter, and `claude plugin validate .`.
- **Bump versions with `scripts/bump-version.sh`**, which keeps every manifest in step.
- **Pull requests** target `main`, fill in `.github/PULL_REQUEST_TEMPLATE.md`, say which agent, model and harness produced them, and get a human's review of the full diff.
