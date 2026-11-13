# just-enough

Coding skills for AI agents that run the full [Superpowers](https://github.com/obra/superpowers) workflow, but write only the code a task needs. Think of a lazy senior developer: the least code that fully works, and never a careless one.

just-enough is a fork of Superpowers, with the rules of [Ponytail](https://github.com/DietrichGebert/ponytail) and the [Karpathy guidelines](https://github.com/multica-ai/andrej-karpathy-skills) folded into every skill.

## How it works

A short start-up rule loads with every session. For coding work, Claude picks the right skill by itself; you never type `/skill`. In Claude Code, a one-line reminder also rides along with each message that looks like coding work, so the rule holds in long chats. Every change to code runs the whole chain:

```
brainstorming → writing-plans → executing-plans (test first) → verification → code review → finishing
```

**Tiny jobs run the whole chain in one short pass.** "Change the tax rate to 20%" loads one skill, `tiny-job`: a one-line design, a one-line plan, one test written first, the change, the test run, a one-line self-review and a one-line finish, with no stops for approval.

**Bigger jobs** get questions (only where something is unclear), a design, a plan you approve, a step-by-step build in the same session, and one full review at the end. Claude asks once whether the design and plan stay in the chat or get saved as files.

**Bugs** start with systematic debugging. Once the root cause is found, the fix joins the chain.

**Everything else** (documents, emails, plain questions) gets a direct answer, with no skill and no process.

## What it adds to Superpowers

- **Least code first.** Brainstorming and planning walk a ladder before any code is planned: does it need to exist? Is it already in the codebase? The standard library? An installed package? One line? Only then, new code.
- **A code budget in every plan.** Each plan states how many new lines it expects, what it reuses, and what it leaves out. Each task names what it reuses and its size.
- **Surgical changes.** Touch only what the task needs; mention unrelated problems instead of fixing them.
- **Plain-English reviews** that read beyond the diff and check bugs, security, real load, missing tests, speed and code that should not exist. Each finding says what the code does, what goes wrong, the smallest fix, and what happens if you skip it.
- **Effort per skill** (Claude Code): easy steps think less, hard ones think more.
- **Honest endings.** Each reply about code ends with one line: what was skipped, and any risk.
- **Never cut:** validation, error handling that prevents data loss, security, accessibility.

## Skills

| Skill | What it does | Effort |
|---|---|---|
| `using-just-enough` | Start-up rule: when to use which skill, and the just-enough rules | — |
| `tiny-job` | Runs the whole chain in one short pass for small changes | low |
| `brainstorming` | Finds out what you want; leads with the smallest approach | medium |
| `writing-plans` | Turns the design into tasks, with a code budget | medium |
| `executing-plans` | Builds the plan step by step in one session (the default) | low |
| `subagent-driven-development` | Builds with a fresh helper per task, if you ask for it | medium |
| `dispatching-parallel-agents` | Runs independent tasks in parallel | medium |
| `test-driven-development` | Writes a failing test before any code | low |
| `systematic-debugging` | Finds the root cause before any fix | high |
| `verification-before-completion` | Runs the checks before anything is called done | low |
| `requesting-code-review` | Reviews a change, at the end of a job or when you ask | medium |
| `receiving-code-review` | Weighs review feedback before acting on it | medium |
| `finishing-a-development-branch` | Final test run, then merge, PR or keep | low |
| `using-git-worktrees` | A separate workspace for bigger jobs | low |
| `audit` | Checks a whole repo and says what to fix first | high |
| `shortcuts` | Lists the `shortcut:` notes left for later | low |
| `diagnosing-just-enough` | Explains why a session went wrong | high |
| `writing-skills` | Helps you write and test new skills | high |

## Time and cost meter

In Claude Code on your own computer (terminal or desktop app), a meter above the prompt shows the task's cost, tokens, agent time, how often existing code was reused, and whether the tests passed after the last change. Its buttons run a review or an audit, copy the task as Markdown, and switch between a compact and a detailed view. Type `/meter` to hide it, and `/meter` again to bring it back. It does not show in cloud sessions.

## Install

### Claude Code

At the prompt of a terminal session:

```
/plugin install just-enough --marketplace YOUR-GITHUB-USERNAME/just-enough
```

Answer `y` to add the marketplace, then pick a scope (user scope is first). From a shell:

```
claude plugin install just-enough --marketplace YOUR-GITHUB-USERNAME/just-enough
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `YOUR-GITHUB-USERNAME/just-enough`, then **Add plugin**.

### Other tools

These come from Superpowers' instructions, pointed at this repo. Each adapter passes its own tests here, but live sessions have only been checked in Claude Code.

| Tool | Install |
|---|---|
| Antigravity | `agy plugin install https://github.com/YOUR-GITHUB-USERNAME/just-enough` |
| Codex | `codex plugin marketplace add YOUR-GITHUB-USERNAME/just-enough`, then `codex plugin add just-enough@just-enough` |
| Devin CLI | `devin plugins install YOUR-GITHUB-USERNAME/just-enough` |
| Factory Droid | `droid plugin marketplace add https://github.com/YOUR-GITHUB-USERNAME/just-enough`, then `droid plugin install just-enough@just-enough` |
| Gemini CLI | `gemini extensions install https://github.com/YOUR-GITHUB-USERNAME/just-enough` |
| GitHub Copilot CLI | `copilot plugin marketplace add YOUR-GITHUB-USERNAME/just-enough`, then `copilot plugin install just-enough@just-enough` |
| Hermes Agent | `hermes plugins install YOUR-GITHUB-USERNAME/just-enough --enable` |
| Kimi Code | `/plugins install https://github.com/YOUR-GITHUB-USERNAME/just-enough` (see [docs/README.kimi.md](docs/README.kimi.md)) |
| Muse | clone this repo, then `muse plugins install ./just-enough` and `muse plugins approve just-enough` |
| OpenCode | tell OpenCode: `Fetch and follow instructions from https://raw.githubusercontent.com/YOUR-GITHUB-USERNAME/just-enough/refs/heads/main/.opencode/INSTALL.md` |
| Pi | `pi install git:github.com/YOUR-GITHUB-USERNAME/just-enough` |
| Qwen Code | `qwen extensions install YOUR-GITHUB-USERNAME/just-enough` |

**Using Superpowers too?** Remove it after installing just-enough, so the two start-up rules don't clash.

**Tip for speed:** the skills raise effort only when a step needs it. Keep your default effort at medium or lower (`/effort` in Claude Code), so plain replies stay quick.

## Check it works

Start a new session in a project with tests and type: "change the tax rate to 20%". Claude should load `tiny-job` by itself, write the test first, and end with the tests passing.

## Development

- `claude plugin validate .` checks the Claude Code plugin.
- `claude plugin test .` runs the meter's tests.
- `bash tests/<area>/<test>.sh` runs the per-tool and per-skill tests; see [docs/testing.md](docs/testing.md).
- `scripts/bump-version.sh <version>` keeps every manifest's version in step.
- Read [AGENTS.md](AGENTS.md) before changing a skill.

## Credits

just-enough builds on the work of others. Thank you to their authors.

- [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent and Prime Radiant: the workflow, the skills, the hooks and every tool adapter. just-enough is a fork of it.
- [Ponytail](https://github.com/DietrichGebert/ponytail) by DietrichGebert: the least-code rules, the review checks, the audit and shortcut skills, and the meter (adapted from its band).
- [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills): the think-first, keep-it-simple, surgical-change and goal-driven rules.

just-enough is not affiliated with these projects. Their copyright notices are in [LICENSE](LICENSE).

## License

MIT. See [LICENSE](LICENSE).
