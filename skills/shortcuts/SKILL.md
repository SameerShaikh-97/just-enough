---
name: shortcuts
description: Use to list every deliberate shortcut left in the code - the `shortcut:` comments that name a limit and when to upgrade - as one list, flagging any with no upgrade trigger. Triggers on "list the shortcuts", "what did we defer", "fix-later list", "tech debt list". Reads and reports only.
effort: low
---

# Shortcuts

Every deliberate shortcut carries a comment: `shortcut: <its limit>, <when to upgrade>`.
This collects them into one list, so "later" does not quietly become "never".

## Scan

Search the repo for the marker in comments, skipping `.git` and everything `.gitignore` ignores:

`git grep --no-index --exclude-standard -nE '(#|//|/[*]|--|<!--) ?shortcut:'`

Add other comment prefixes if the project's languages use them. If the user names
another marker word (for example `TODO`), search for that word instead. Skip hits
that are not a deferral, like a note about a keyboard shortcut.

## Output

One row per marker, grouped by file:

`<file>:<line> - <what was simplified>. Limit: <the limit named>. Upgrade when: <the trigger>.`

Tag any marker that names no upgrade trigger with `no-trigger`: those are the ones
that rot quietly. Want an owner per row? Add `git blame -L<line>,<line> <file>`.

End with `<N> shortcuts, <M> with no trigger.` Nothing found: `No shortcuts recorded. Clean list.`

Reads and reports only. To keep the list as a file, ask the user first, then write
it where they say.
