// The meter's state contract. Adapted from Ponytail's band (github.com/DietrichGebert/ponytail, MIT, (c) 2026 DietrichGebert).

export type Tests = {
  state: 'none' | 'pass' | 'fail' | 'stale'
  passed?: number
  failed?: number
}

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type Meter = {
  cost: number
  spent: number
  turns: number
  turnCosts: number[]
  tokens: Tokens
  busyMs: number
  name: string
  project: string
  session: string
  reused: string[]
  created: string[]
  removed: string[]
  openCallers: string[]
  tests: Tests
  details: boolean
  hidden: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'just-enough': { meter: Meter }
  }
}
