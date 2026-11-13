// The just-enough meter: what the current task costs, shown above the prompt in Claude Code.
// Adapted from Ponytail's band (github.com/DietrichGebert/ponytail, MIT, (c) 2026 DietrichGebert).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Meter } from './types'
import type { Col } from './metrics'
import {
  GREP_DEFS,
  NO_TOKENS,
  addTokens,
  addedLines,
  callsIn,
  defsIn,
  elapsed,
  fmtTokens,
  hits,
  inProject,
  isCode,
  isSource,
  isTestCommand,
  markdown,
  metricsSvg,
  parseDefs,
  percent,
  snapshot,
  testCounts,
  testsLabel,
  totalTokens,
} from './metrics'

const EMPTY: Meter = {
  cost: 0,
  spent: 0,
  turns: 0,
  turnCosts: [],
  tokens: NO_TOKENS,
  busyMs: 0,
  name: '',
  project: '',
  session: '',
  reused: [],
  created: [],
  removed: [],
  openCallers: [],
  tests: { state: 'none' },
  details: false,
  hidden: false,
}
// The counters of one task: what /clear starts over.
const TASK = {
  spent: 0,
  turns: 0,
  turnCosts: [],
  tokens: NO_TOKENS,
  busyMs: 0,
  name: '',
  reused: [],
  created: [],
  removed: [],
  openCallers: [],
  tests: { state: 'none' as const },
}
const meter = atom({ plugin: 'just-enough', key: 'meter' } as const, EMPTY)
// State kept from an older version of the meter lacks newer fields.
const load = async ($: EngineInterface): Promise<Meter> => ({ ...EMPTY, ...(await read($, meter)) })

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])]
const base = (path: string) => path.replace(/\/+$/, '').split('/').pop() ?? path

// The same commands a person types, so the skills stay the only logic.
const run = ($: EngineInterface, command: string) => $.command.run({ command, args: '' })

// Sets the meter up for a session (project, cost baseline, view); returns the definitions that exist now.
async function start($: EngineInterface): Promise<Map<string, string>> {
  await $.command.register({ name: 'meter', description: 'Show or hide the just-enough meter above the prompt', argumentHint: '[on|off]' }).catch(() => undefined)
  const grep = await $.process.run(['git', 'grep', '--untracked', '-nE', GREP_DEFS]).catch(() => undefined)
  const details = (await $.store.get('details')) === true
  const hidden = (await $.store.get('hidden')) === true
  const repo = await $.session.repo().catch(() => null)
  const project = base(repo?.root ?? (await $.session.cwd()))
  const session = await $.session.id()
  // The cost so far is the baseline for the last turn's own cost.
  const usage = await $.session.usage().catch(() => undefined)
  await update($, meter, b => ({ ...EMPTY, ...b, details, hidden, project, session, cost: usage?.cost?.usd ?? b.cost }))
  return grep?.exitCode === 0 ? parseDefs(grep.stdout) : new Map()
}

export const register: Register = on => {
  // Definitions that existed when the session started: what new code can reuse.
  let known = new Map<string, string>()

  on('session.start', async ($, e, next) => {
    known = await start($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /clear, /resume and /branch go on under another session id with no session.start: set the meter up again.
  on('command.run', { command: ['clear', 'resume', 'branch'] }, async ($, e, next) => {
    const session = await $.session.id()
    const result = await next(e)
    if ((await $.session.id()) !== session) known = await start($).catch(() => known)
    return result
  }).catch(($, e, next) => next(e))

  // /meter shows or hides the meter; /meter on and /meter off set it directly.
  on('command.run', { command: 'meter' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const hidden = arg === 'off' ? true : arg === 'on' ? false : !(await load($)).hidden
    await update($, meter, x => ({ ...EMPTY, ...x, hidden }))
    await $.store.set('hidden', hidden)
    return { text: hidden ? 'Meter hidden. Type /meter to show it again.' : 'Meter shown above the prompt.' }
  }).catch(() => ({ text: 'Could not switch the meter.' }))

  // /clear starts a new task: the counters start over, the cost baseline stays.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, meter, b => ({ ...EMPTY, ...b, ...TASK }))
    return next(e)
  }).catch(($, e, next) => next(e))

  // The first prompt names the task.
  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    if (e.origin.kind !== 'plugin' && text !== '' && !text.startsWith('/')) {
      const name = (text.split('\n')[0] ?? '').slice(0, 60)
      await update($, meter, b => (b.name === '' ? { ...EMPTY, ...b, name } : b))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash') {
      const ran = await next(e)
      if (ran.deny === undefined && isTestCommand(e.command)) {
        const tests = { state: ran.isError ? ('fail' as const) : ('pass' as const), ...testCounts(ran.text ?? '') }
        await update($, meter, b => ({ ...b, tests }))
      }
      return ran
    }

    if (e.tool !== 'Edit' && e.tool !== 'Write') return next(e)

    const file = e.file_path
    // A scratch script outside the project is never reused or called by it.
    const repo = await $.session.repo().catch(() => null)
    if (!inProject(file, repo?.root ?? (await $.session.cwd()))) return next(e)
    const before = e.tool === 'Write' ? await $.fs.read(file).catch(() => '') : e.old_string
    const after = e.tool === 'Write' ? e.content : e.new_string
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError) return ran

    const oldDefs = defsIn(file, before)
    const newDefs = defsIn(file, after)
    const created = isSource(file) ? newDefs.filter(n => !oldDefs.includes(n)) : []
    const removed = oldDefs.filter(n => !newDefs.includes(n))
    const reused = isSource(file) ? callsIn(addedLines(before, after), known, newDefs) : []

    await update($, meter, b => ({
      ...b,
      reused: union(b.reused, reused),
      created: union(b.created, created),
      removed: union(b.removed, removed),
      tests: isCode(file) && b.tests.state !== 'none' ? { ...b.tests, state: 'stale' as const } : b.tests,
    }))

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const used = e.usage
    if (e.agentId !== undefined) {
      // A subagent's tokens count; its cost is already in the session cost the main turn reads.
      if (used) await update($, meter, b => ({ ...EMPTY, ...b, tokens: addTokens(b.tokens ?? NO_TOKENS, used) }))
      return next(e)
    }

    const usage = await $.session.usage()
    const turns = await $.session.turns()
    const { removed } = await load($)

    // A removed or renamed definition that is not defined again but still called somewhere.
    // shortcut: name match with git grep, so a same-named call in another module counts too.
    const stillRemoved: string[] = []
    const open: string[] = []
    for (const name of removed) {
      const grep = await $.process.run(['git', 'grep', '--untracked', '-nw', '-e', name]).catch(() => undefined)
      const rows = hits(grep?.stdout ?? '')
      if (rows.some(r => defsIn(r.file, r.text.trimStart()).includes(name))) continue
      const call = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}\\s*\\(`)
      const refs = rows.filter(r => call.test(r.text)).map(r => `${r.file}:${r.line}`)
      if (refs.length > 0) {
        stillRemoved.push(name)
        open.push(...refs)
      }
    }

    await update($, meter, x => {
      const b = { ...EMPTY, ...x }
      const cost = usage.cost?.usd ?? b.cost
      // A cost below the baseline means the engine started its ledger over.
      const turn = cost >= b.cost ? cost - b.cost : cost
      return {
        ...b,
        cost,
        // Cost and turns are the session's own totals, so a reload never starts them over.
        spent: usage.cost?.usd ?? b.spent + turn,
        turns,
        turnCosts: [...b.turnCosts, turn].slice(-20),
        tokens: used ? addTokens(b.tokens, used) : b.tokens,
        busyMs: b.busyMs + e.durationMs,
        removed: stillRemoved,
        openCallers: open,
      }
    })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const b = await load($)
    if (e.props.hasSurvey || b.hidden) return next(e)
    // Other mods share this slot: draw theirs below ours instead of replacing it.
    // next(e) rejects only when nothing answers beneath (the test harness): the meter still draws.
    const below = await next(e).catch(() => undefined)

    const now = await $.clock.now()
    const startedAt = (await $.session.usage().catch(() => undefined))?.startedAt ?? now
    const reuse = percent(b.reused.length, b.created.length)
    const avg = b.turns > 0 ? b.spent / b.turns : 0
    const last = b.turnCosts[b.turnCosts.length - 1]

    const toggle = async () => {
      await update($, meter, x => ({ ...x, details: !x.details }))
      await $.store.set('details', !b.details)
    }
    const review = () => run($, 'just-enough:requesting-code-review')
    const audit = () => run($, 'just-enough:audit')
    const copy = async () => {
      const done = await $.ui.copy({ text: markdown(snapshot(await load($), startedAt)), surface: e.surface })
      $.ui.toast(done.isCopied ? 'Task copied as Markdown' : `Copy failed: ${done.reason}`)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    // bodyColumns counts terminal cells; a graphical surface draws Buttons wider than their cells, so a row sized to it wraps there.
    const width = e.surface === 'terminal' ? e.props.bodyColumns : undefined
    const stack = (mine: NonNullable<typeof below>) => (below ? <Box flexDirection="column">{mine}{below}</Box> : mine)

    const testsText =
      b.tests.state === 'pass'
        ? `✓ ${b.tests.passed ?? ''} tests`
        : b.tests.state === 'fail'
          ? `✗ ${b.tests.failed ?? ''} failed`
          : b.tests.state === 'stale'
            ? 'no test since change'
            : ''
    const testsColor = b.tests.state === 'pass' ? 'success' : b.tests.state === 'fail' ? 'error' : undefined
    const hasOpen = b.openCallers.length > 0

    if (!b.details) {
      return stack(
        <Box key="meter" flexDirection="row" alignItems="center" gap={2} width={width}>
          <Button key="toggle" plain onPress={toggle}>
            <Text color="suggestion">●</Text> just-enough
          </Button>
          <Text>${b.spent.toFixed(2)}</Text>
          {last !== undefined && <Text dimColor>last ${last.toFixed(2)}</Text>}
          <Text dimColor>{elapsed(b.busyMs)}</Text>
          {reuse !== undefined && <Text>{reuse}% reuse</Text>}
          {hasOpen && <Text color="warning">⚠ {b.openCallers.length} callers open</Text>}
          {testsText !== '' && (
            <Text color={testsColor} dimColor={b.tests.state === 'stale'}>
              {testsText}
            </Text>
          )}
          <Box flexGrow={1} />
          <Button key="review" plain label="Review" onPress={review} />
          <Button key="audit" plain label="Audit" onPress={audit} />
          <Button key="details" plain label="Details" onPress={toggle} />
        </Box>
      )
    }

    // Only columns that say something; callers and tests appear once there is something to report.
    const cols: Col[] = [
      { key: 'cost', label: 'cost', value: `$${b.spent.toFixed(2)}`, sub: last === undefined ? '' : `last $${last.toFixed(2)} · ⌀ $${avg.toFixed(2)}` },
      { key: 'tokens', label: 'tokens', value: fmtTokens(totalTokens(b.tokens)), sub: `${b.turns} ${b.turns === 1 ? 'turn' : 'turns'}` },
      { key: 'time', label: 'agent time', value: elapsed(b.busyMs), sub: b.turns > 0 ? `⌀ ${elapsed(b.busyMs / b.turns)} / turn` : '' },
    ]
    if (reuse !== undefined) cols.push({ key: 'reuse', label: 'reuse', value: `${reuse}%`, sub: '' })
    if (hasOpen) {
      cols.push({ key: 'callers', label: 'callers', value: `${b.openCallers.length} open`, sub: b.openCallers.slice(0, 2).join(', '), tone: 'warning' })
    }
    if (b.tests.state !== 'none') {
      cols.push({
        key: 'tests',
        label: 'tests',
        value: testsLabel(b.tests),
        sub: b.tests.state === 'pass' ? 'after last change' : b.tests.state === 'fail' ? 'last run' : 'code changed since',
        tone: b.tests.state === 'pass' ? 'success' : b.tests.state === 'fail' ? 'error' : undefined,
      })
    }

    let metrics = (
      <Box flexDirection="column">
        <Text dimColor wrap="truncate-end">
          {'─'.repeat(e.props.bodyColumns)}
        </Text>
        <Box flexDirection="row" gap={2}>
          {cols.map(c => (
            // Off the terminal the columns share the row; a width in cells would leave most of it empty and cut the text.
            <Box key={c.key} flexDirection="column" {...(width === undefined ? { flexGrow: 1 } : { width: Math.max(10, Math.floor(width / cols.length) - 2) })}>
              <Text dimColor>{c.label}</Text>
              <Text bold color={c.tone}>
                {c.value}
              </Text>
              <Text dimColor wrap="truncate-end">
                {c.sub}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
    // Text glyphs make broken lines in the desktop's proportional font; an SVG draws real ones.
    if (e.surface === 'desktop') {
      const { Svg } = $.ui.resolve(e)
      metrics = <Svg source={metricsSvg(cols, b.turnCosts)} alt={cols.map(c => `${c.label} ${c.value}`).join(', ')} />
    }

    return stack(
      // The desktop's SVG draws its own line at the top, which would touch the buttons without the gap.
      <Box key="meter" flexDirection="column" width={width} gap={e.surface === 'desktop' ? 1 : 0}>
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color="suggestion">●</Text>
          <Text>just-enough</Text>
          <Box flexGrow={1} />
          <Button key="copy" plain label="Copy" onPress={copy} />
          <Button key="review" plain label="Review" onPress={review} />
          <Button key="audit" plain label="Audit" onPress={audit} />
          <Button key="details" plain label="Compact" onPress={toggle} />
        </Box>
        {metrics}
      </Box>
    )
  }).catch(($, e, next) => next(e))
}
