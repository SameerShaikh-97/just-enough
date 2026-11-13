// Tests for the meter. Run: claude plugin test <this plugin's folder>
// Adapted from Ponytail's band tests (github.com/DietrichGebert/ponytail, MIT, (c) 2026 DietrichGebert).
import { describe, expect, mock, test } from 'claude-code/testing'

import type { Meter } from '../../hooks/meter/types'
import {
  NO_TOKENS,
  addTokens,
  addedLines,
  callsIn,
  defsIn,
  duration,
  elapsed,
  fmtTokens,
  inProject,
  isTestCommand,
  markdown,
  metricsSvg,
  parseDefs,
  percent,
  snapshot,
  testCounts,
  totalTokens,
} from '../../hooks/meter/metrics'

describe('metrics', () => {
  test('adds up tokens and prints them short', () => {
    const t = addTokens(addTokens(NO_TOKENS, { input_tokens: 10, output_tokens: 90, cache_read_input_tokens: 1000, cache_creation_input_tokens: 0 }), { input_tokens: 0, output_tokens: 10, cache_read_input_tokens: 140, cache_creation_input_tokens: 0 })
    expect(totalTokens(t)).toBe(1250)
    expect(t.output).toBe(100)
    expect([fmtTokens(950), fmtTokens(1234), fmtTokens(1_240_000), fmtTokens(2000)]).toEqual(['950', '1.2k', '1.2M', '2k'])
  })

  const BASE: Meter = {
    cost: 31.9, spent: 3.1, turns: 6, turnCosts: [0.42], tokens: { input: 5000, output: 85_000, cacheRead: 1_100_000, cacheWrite: 10_000 },
    busyMs: 1_560_000, name: 'Fix the cart | totals, again', project: 'shop', session: '4c69e3db-57a0', reused: ['to_cents'], created: [],
    removed: [], openCallers: [], tests: { state: 'pass', passed: 14 }, details: false, hidden: false,
  }

  test('agent time reads in seconds, minutes, hours', () => {
    expect([elapsed(45_000), elapsed(130_000), elapsed(4_320_000)]).toEqual(['45s', '2m 10s', '1h 12m'])
  })

  test('the Markdown export holds every value and the task name', () => {
    const md = markdown(snapshot(BASE, Date.UTC(2026, 9, 15, 12, 0)))
    expect(md.split('\n')[0]).toBe('## Fix the cart \\| totals, again')
    expect(md).toContain('| Cost | $3.10 · last turn $0.42 · ⌀ $0.52 / turn |')
    expect(md).toContain('| Agent time | 26m 0s · ⌀ 4m 20s / turn |')
    expect(md).toContain('| Tokens | 1.2M (input 5k, output 85k, cache read 1.1M, cache write 10k) |')
    expect(md).toContain('| Tests | 14 passed |')
    expect(md).not.toContain('level')
  })

  test('the desktop row is one SVG with real dividers, escaped and cut to fit', () => {
    const svg = metricsSvg(
      [
        { key: 'cost', label: 'cost', value: '$1.20', sub: '' },
        { key: 'callers', label: 'callers', value: '2 open', sub: 'a&b.py:1, a very long path/that/does/not/fit.py:9', tone: 'warning' },
      ],
      [0.1, 0.4],
      300,
    )
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.match(/<line /g)?.length).toBe(2)
    expect(svg).toContain('a&amp;b.py')
    expect(svg).toContain('…')
    expect(svg).toContain('class="v warning"')
    expect(svg.match(/<rect /g)?.length).toBe(2)
  })

  test('finds top-level definitions per language', () => {
    expect(defsIn('a.py', 'def to_cents(x):\n    pass\nclass Cart:\n    def total(self): pass')).toEqual(['to_cents', 'Cart'])
    expect(defsIn('a.ts', 'export function formatMoney() {}\nfunction local() {}\nconst x = 1')).toEqual(['formatMoney', 'local'])
    expect(defsIn('README.md', 'def nope():')).toEqual([])
  })

  test('counts calls of existing helpers, never new ones, test files or generic names', () => {
    const known = parseDefs('utils/money.py:4:def to_cents(v):\nutils/io.py:1:def load(p):\ntests/test_x.py:1:def helper():')
    expect([...known.keys()]).toEqual(['to_cents', 'load'])
    const added = addedLines('x = 1', 'x = 1\ny = to_cents(p)\nz = load(f)\nw = parse_price(s)')
    expect(added).not.toContain('x = 1')
    expect(callsIn(added, known, ['parse_price'])).toEqual(['to_cents'])
  })

  test('only files under the project root count, with either slash', () => {
    expect(inProject('/repo/shop/cart.py', '/repo/shop')).toBe(true)
    expect(inProject('/repo/shop/cart.py', '/repo/shop/')).toBe(true)
    expect(inProject('/tmp/scratch/drive.py', '/repo/shop')).toBe(false)
    expect(inProject('/repo/shop-old/cart.py', '/repo/shop')).toBe(false)
    expect(inProject('C:\\Users\\a\\shop\\cart.py', 'C:/Users/a/shop')).toBe(true)
  })

  test('recognises test runs and their counts', () => {
    expect(isTestCommand('npm test')).toBe(true)
    expect(isTestCommand('cd api && python -m pytest -q')).toBe(true)
    expect(isTestCommand('npm install')).toBe(false)
    expect(testCounts('===== 14 passed, 1 failed in 0.31s =====')).toEqual({ passed: 14, failed: 1 })
    expect(testCounts('ℹ pass 141\nℹ fail 1')).toEqual({ passed: 141, failed: 1 })
    expect(testCounts('ok')).toEqual({ passed: undefined, failed: undefined })
  })

  test('shows the reuse share only once there is something to share, and a readable time', () => {
    expect(percent(5, 1)).toBe(83)
    expect(percent(0, 1)).toBeUndefined()
    expect(percent(0, 0)).toBeUndefined()
    expect(duration(45)).toBe('45m')
    expect(duration(210)).toBe('3h 30m')
  })
})

const ABOVE = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

test('the meter switches between compact and details on terminal and desktop', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'just-enough', surface, ...ABOVE })
    expect(await ui.find({ key: 'toggle' })).toBeDefined()
    expect(await ui.find({ key: 'review' })).toBeDefined()
    expect(await ui.find({ key: 'copy' })).toBeUndefined()

    await ui.press({ key: 'details' })
    expect(await ui.find({ key: 'copy' })).toBeDefined()
    expect(await ui.find({ key: 'audit' })).toBeDefined()
    if (surface === 'desktop') expect(await ui.find({ type: 'Svg' })).toBeDefined()
    else expect(await ui.find({ type: 'Text', text: /cost/ })).toBeDefined()

    await ui.press({ key: 'details' })
    expect(await ui.find({ key: 'toggle' })).toBeDefined()
    await ui.unmount()
  }
})

test('the row takes bodyColumns only in the terminal, where a Button is as wide as its cells', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  for (const [surface, width] of [['terminal', 100], ['vscode', undefined]] as const) {
    const ui = await $.ui.mount({ plugin: 'just-enough', surface, ...ABOVE })
    expect((await ui.find({ key: 'meter' }))?.props.width).toBe(width)
    await ui.press({ key: 'details' })
    expect((await ui.find({ key: 'meter' }))?.props.width).toBe(width)
    await ui.press({ key: 'details' })
    await ui.unmount()
  }
})

test('/meter hides the meter and shows it again', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  // What Claude Code draws without the meter.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>prompt only</Text>
  })
  const ui = await $.ui.mount({ plugin: 'just-enough', surface: 'terminal', ...ABOVE })
  expect(await ui.find({ key: 'toggle' })).toBeDefined()

  // The engine stamps origin and presentation on a real run; the test leaves them out.
  const off = await $.command.run({ command: 'meter', args: '' } as never)
  expect(off.text).toContain('hidden')
  expect(await ui.find({ key: 'toggle' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /prompt only/ })).toBeDefined()

  const back = await $.command.run({ command: 'meter', args: 'on' } as never)
  expect(back.text).toContain('shown')
  expect(await ui.find({ key: 'toggle' })).toBeDefined()
  await ui.unmount()
})

test("another plugin's command runs without the meter's hooks", async ($, on) => {
  let reads = 0
  on('session.id', () => (reads++, { value: 's1' }))
  on('command.run', () => ({ text: '' }))
  await $.command.run({ command: 'anymodel', args: '' } as never)
  expect(reads).toBe(0)
})
