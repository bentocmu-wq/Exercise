import { beforeEach, describe, expect, it } from 'vitest'
import { activeSession, nextDayIndex, useStore } from './store'
import { DEFAULT_PROFILE } from '../ui/ProfileForm'
import { exportCsv, exportJson } from './exportData'
import { exerciseMap } from './store'

const run = (weight: number, reps: number[], rir?: number) => {
  const s = useStore.getState()
  const dayId = s.program!.days[nextDayIndex(s)].id
  s.startSession(dayId, { sleep: 4, energy: 4, soreness: 2, stress: 2 })
  const sess = activeSession(useStore.getState())!
  const idx = sess.exercises.findIndex(e => e.exerciseId === 'barbell-bench-press')
  const prs = reps.map(r => useStore.getState().logSet(idx, { weight, reps: r, rir }))
  const coach = useStore.getState().completeExercise(idx)
  const done = useStore.getState().finishSession()!
  return { prs, coach, done, idx }
}

describe('store flow: plan → train → log → analyze → progress', () => {
  beforeEach(() => { useStore.getState().resetAll() })

  it('generates a program from the profile', () => {
    useStore.getState().saveProfile({ ...DEFAULT_PROFILE, daysPerWeek: 4, sessionMinutes: 90 }, true)
    const p = useStore.getState().program!
    expect(p.days.map(d => d.name)).toEqual(['Upper 1', 'Lower 1', 'Upper 2', 'Lower 2'])
    expect(useStore.getState().bodyWeights).toHaveLength(1)
  })

  it('recommends from history, detects PRs, and rotates days', () => {
    useStore.getState().saveProfile({ ...DEFAULT_PROFILE, daysPerWeek: 4, sessionMinutes: 90 }, true)
    // Session 1: first time ever → no recommendation weight, no PR
    const s1 = run(70, [9, 9, 9], 2)
    expect(s1.prs.flat()).toEqual([])
    expect(useStore.getState().sessions).toHaveLength(1)
    expect(nextDayIndex(useStore.getState())).toBe(1)           // → Lower 1
    // Lower 1 (no bench) then Upper 2 has no barbell bench; run Upper 1 again after a full rotation
    for (let i = 0; i < 3; i++) { const s = useStore.getState(); s.startSession(s.program!.days[nextDayIndex(s)].id); useStore.getState().finishSession() }
    expect(nextDayIndex(useStore.getState())).toBe(0)           // back to Upper 1
    // Session 2: recommendation must be built from session 1 (empty sessions are dropped, so history = session 1)
    const s = useStore.getState()
    s.startSession(s.program!.days[0].id, { sleep: 4, energy: 4, soreness: 2, stress: 2 })
    const bench = activeSession(useStore.getState())!.exercises.find(e => e.exerciseId === 'barbell-bench-press')!
    expect(bench.recommendation.recommendedWeight).toBe(70)     // reps 9 < repMax 10 → hold
    expect(bench.recommendation.action).toBe('HOLD')
    expect(bench.recommendation.evidence.length).toBe(3)
    useStore.getState().discardSession()
  })

  it('PR detection against history, record storage, and double progression across sessions', () => {
    useStore.getState().saveProfile({ ...DEFAULT_PROFILE, daysPerWeek: 3, sessionMinutes: 120 }, true)
    // Full Body A has bench; rotation A,B,C. Make sessions so bench shows on A only.
    const first = run(70, [12, 12, 12, 12], 2)
    expect(first.prs.flat()).toEqual([])
    useStore.getState().deleteSession(first.done.id)
    // re-log as two sessions to get history then PR
    const a = run(70, [12, 12, 12, 12], 2)
    expect(a.coach).toContain('Next session แนะนำ 72.5 kg')
    for (let i = 0; i < 2; i++) { const s = useStore.getState(); s.startSession(s.program!.days[nextDayIndex(s)].id); useStore.getState().finishSession() }
    const b = run(72.5, [8, 8, 8], 2)                              // heavier than ever → weight PR on first set only
    expect(b.prs[0]).toContain('weight')
    expect(b.prs[1]).not.toContain('weight')
    expect(useStore.getState().records.some(r => r.kind === 'weight' && r.weight === 72.5)).toBe(true)
  })

  it('pain flag blocks automatic increase next time', () => {
    useStore.getState().saveProfile({ ...DEFAULT_PROFILE, daysPerWeek: 3, sessionMinutes: 120 }, true)
    const s = useStore.getState()
    s.startSession(s.program!.days[0].id)
    const idx = activeSession(useStore.getState())!.exercises.findIndex(e => e.exerciseId === 'barbell-bench-press')
    ;[12, 12, 12, 12].forEach(r => useStore.getState().logSet(idx, { weight: 70, reps: r, rir: 2 }))
    useStore.getState().setPain(idx, true, 'ไหล่ขวา')
    useStore.getState().finishSession()
    for (let i = 0; i < 2; i++) { const t = useStore.getState(); t.startSession(t.program!.days[nextDayIndex(t)].id); useStore.getState().finishSession() }
    const t = useStore.getState(); t.startSession(t.program!.days[0].id)
    const rec = activeSession(useStore.getState())!.exercises.find(e => e.exerciseId === 'barbell-bench-press')!.recommendation
    expect(rec.action).toBe('HOLD'); expect(rec.warning).toContain('ไหล่ขวา')
  })

  it('rejects invalid sets, exports and restores data', () => {
    useStore.getState().saveProfile(DEFAULT_PROFILE, true)
    const s = useStore.getState()
    s.startSession(s.program!.days[0].id)
    expect(useStore.getState().logSet(0, { weight: 50, reps: 0 })).toEqual([])
    expect(activeSession(useStore.getState())!.exercises[0].sets).toHaveLength(0)
    useStore.getState().logSet(0, { weight: 50, reps: 8, rir: 2 })
    useStore.getState().finishSession()
    const st = useStore.getState()
    const json = exportJson(st)
    expect(exportCsv(st, exerciseMap(st)).split('\n')).toHaveLength(2)
    useStore.getState().resetAll()
    expect(useStore.getState().sessions).toHaveLength(0)
    expect(useStore.getState().importData(json)).toEqual({ ok: true })
    expect(useStore.getState().sessions).toHaveLength(1)
    expect(useStore.getState().importData('not json').ok).toBe(false)
    expect(useStore.getState().importData('{"app":"other"}').ok).toBe(false)
  })

  it('body weight validation', () => {
    useStore.getState().addBodyWeight('2026-06-01', 5)
    useStore.getState().addBodyWeight('2026-06-01', 63.2)
    useStore.getState().addBodyWeight('2026-06-01', 63.4)       // same day replaces
    expect(useStore.getState().bodyWeights).toHaveLength(1)
    expect(useStore.getState().bodyWeights[0].kg).toBe(63.4)
  })
})
