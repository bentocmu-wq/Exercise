import { describe, expect, it } from 'vitest'
import { calculateE1RM } from './e1rm'
import { calculateVolume } from './volume'
import { calculateNextWeight, roundToIncrement, type ProgressionInput } from './progression'
import { calculateReadiness } from './readiness'
import { detectPR, detectVolumePR } from './pr'
import { detectDeload } from './deload'
import { estimateMinutes, generateProgram, generateWorkout } from './generator'
import { mesoTarget, mesocycleWeek, deloadSets } from './periodization'
import { bodyWeightStats } from './bodyweight'
import { setStatus, isHardSet } from './analytics'
import { SEED_EXERCISES } from '../data/exercises'

const base: Omit<ProgressionInput, 'previousSets'> = {
  targetRepMin: 8, targetRepMax: 12, targetRirMin: 1, targetRirMax: 2,
  exerciseType: 'compound', increment: 2.5, plannedSets: 4
}
const sets = (w: number, reps: number[], rir?: number[]) => reps.map((r, i) => ({ weight: w, reps: r, rir: rir?.[i] }))

describe('calculateE1RM', () => {
  it('Epley', () => expect(calculateE1RM(100, 5)).toBe(116.7))
  it('1 rep = weight', () => expect(calculateE1RM(100, 1)).toBe(100))
  it('invalid → 0', () => {
    expect(calculateE1RM(0, 10)).toBe(0)
    expect(calculateE1RM(100, 0)).toBe(0)
    expect(calculateE1RM(NaN, 5)).toBe(0)
  })
})

describe('calculateVolume', () => {
  it('sums weight × reps', () => expect(calculateVolume([{ weight: 70, reps: 10 }, { weight: 70, reps: 9 }])).toBe(1330))
  it('ignores zero / invalid sets', () => expect(calculateVolume([{ weight: 0, reps: 10 }, { weight: 50, reps: 0 }, { weight: 50, reps: NaN }])).toBe(0))
  it('empty', () => expect(calculateVolume([])).toBe(0))
})

describe('roundToIncrement', () => {
  it('rounds', () => { expect(roundToIncrement(68.9, 2.5)).toBe(70); expect(roundToIncrement(71, 2.5, 'down')).toBe(70) })
})

describe('calculateNextWeight – spec scenarios', () => {
  it('holds when not all sets hit top (12/12/11/10)', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 11, 10]) })
    expect(r.action).toBe('HOLD'); expect(r.recommendedWeight).toBe(70)
  })
  it('increases 70 → 72.5 when 12/12/12/12', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 12, 12]) })
    expect(r.action).toBe('INCREASE'); expect(r.recommendedWeight).toBe(72.5)
    expect(r.reason).toContain('12 reps')
  })
  it('goes back to 70 from 72.5 on 8/7/6/6', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(72.5, [8, 7, 6, 6]) })
    expect(r.action).toBe('DECREASE'); expect(r.recommendedWeight).toBe(70)
  })
  it('autoreg: 12 reps @ RIR 3 ×3 → increase', () => {
    const r = calculateNextWeight({ ...base, plannedSets: 3, previousSets: sets(60, [12, 12, 12], [3, 3, 3]) })
    expect(r.action).toBe('INCREASE'); expect(r.confidence).toBe('high')
  })
  it('autoreg: 9/8/6 at RIR 1/0/0 → reduce 5–10 %', () => {
    const r = calculateNextWeight({ ...base, plannedSets: 3, previousSets: sets(80, [9, 8, 6], [1, 0, 0]) })
    expect(r.action).toBe('DECREASE')
    expect(r.recommendedWeight!).toBeLessThanOrEqual(76); expect(r.recommendedWeight!).toBeGreaterThanOrEqual(72)
    expect(r.reason.length).toBeGreaterThan(10)
  })
  it('top of range but RIR below target → hold (no blind progression)', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 12, 12], [0, 0, 0, 0]) })
    expect(r.action).toBe('HOLD')
  })
  it('spec §28: 12/12/12 at RIR 2 still increases even when the week target is RIR 3', () => {
    const r = calculateNextWeight({ ...base, targetRirMin: 3, targetRirMax: 3, plannedSets: 3, previousSets: sets(70, [12, 12, 12], [2, 2, 2]) })
    expect(r.action).toBe('INCREASE'); expect(r.recommendedWeight).toBe(72.5)
  })
  it('very high RIR on compound → two steps', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 12, 12], [4, 4, 4, 4]) })
    expect(r.recommendedWeight).toBe(75)
  })
  it('too easy within range (RIR ≥ target+2) → increase', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [10, 10, 9, 9], [4, 4, 4, 4]) })
    expect(r.action).toBe('INCREASE'); expect(r.recommendedWeight).toBe(72.5)
  })
})

describe('calculateNextWeight – edge cases', () => {
  it('no history → START with null weight', () => {
    const r = calculateNextWeight({ ...base, previousSets: [] })
    expect(r.action).toBe('START'); expect(r.recommendedWeight).toBeNull()
  })
  it('failed sets (0 reps) → decrease one step', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(80, [0, 0]) })
    expect(r.action).toBe('DECREASE'); expect(r.recommendedWeight).toBe(77.5)
  })
  it('missing RIR still works (medium confidence)', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 12, 12]) })
    expect(r.action).toBe('INCREASE'); expect(r.confidence).toBe('medium')
  })
  it('weight = 0 (bodyweight) can progress by an increment', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(0, [12, 12, 12, 12]) })
    expect(r.recommendedWeight).toBe(2.5)
  })
  it('incomplete session (fewer sets than planned) holds', () => {
    const r = calculateNextWeight({ ...base, plannedSets: 4, previousSets: sets(70, [12, 12]) })
    expect(r.action).toBe('HOLD')
  })
  it('pain flag blocks progression and warns', () => {
    const r = calculateNextWeight({ ...base, previousSets: sets(70, [12, 12, 12, 12]), painFlag: true, painNote: 'ไหล่' })
    expect(r.action).toBe('HOLD'); expect(r.warning).toContain('ไหล่')
  })
  it('low readiness lowers load; mid readiness blocks increase', () => {
    const inc = { ...base, previousSets: sets(70, [12, 12, 12, 12]) }
    expect(calculateNextWeight({ ...inc, readinessScore: 20 }).action).toBe('DECREASE')
    expect(calculateNextWeight({ ...inc, readinessScore: 45 }).action).toBe('HOLD')
    expect(calculateNextWeight({ ...inc, readinessScore: 80 }).action).toBe('INCREASE')
  })
})

describe('calculateReadiness', () => {
  it('good day', () => {
    const r = calculateReadiness({ sleep: 5, energy: 4, soreness: 2, stress: 2 })!
    expect(r.score).toBeGreaterThanOrEqual(70); expect(r.advice).toBe('proceed')
  })
  it('neutral = proceed', () => expect(calculateReadiness({ sleep: 3, energy: 3, soreness: 3, stress: 3 })!.advice).toBe('proceed'))
  it('bad day = reduce_load', () => expect(calculateReadiness({ sleep: 1, energy: 2, soreness: 5, stress: 4 })!.advice).toBe('reduce_load'))
  it('invalid → null', () => { expect(calculateReadiness({ sleep: 0, energy: 3, soreness: 3, stress: 3 })).toBeNull(); expect(calculateReadiness({ sleep: 3, energy: 6, soreness: 3, stress: 3 })).toBeNull() })
})

describe('detectPR', () => {
  const prior = [{ weight: 70, reps: 10 }, { weight: 70, reps: 8 }, { weight: 60, reps: 12 }]
  it('first ever log is not a PR', () => expect(detectPR({ weight: 100, reps: 5 }, [])).toEqual([]))
  it('heaviest weight', () => expect(detectPR({ weight: 72.5, reps: 5 }, prior)).toContain('weight'))
  it('rep PR at same load', () => expect(detectPR({ weight: 70, reps: 11 }, prior)).toContain('reps'))
  it('e1RM PR', () => expect(detectPR({ weight: 67.5, reps: 12 }, prior)).toContain('e1rm'))
  it('no PR when equal / worse', () => expect(detectPR({ weight: 70, reps: 10 }, prior)).toEqual([]))
  it('ignores 0-rep sets', () => expect(detectPR({ weight: 200, reps: 0 }, prior)).toEqual([]))
  it('volume PR', () => { expect(detectVolumePR(3000, [2800, 2900])).toBe(true); expect(detectVolumePR(3000, [])).toBe(false) })
})

describe('detectDeload', () => {
  it('needs ≥ 2 signals', () => {
    expect(detectDeload({ e1rmChangePct: -3 }).shouldDeload).toBe(false)
    const d = detectDeload({ e1rmChangePct: -3, avgReadiness: 40 })
    expect(d.shouldDeload).toBe(true); expect(d.volumeReductionPct).toEqual([30, 40])
  })
  it('3+ signals also lower load', () => {
    const d = detectDeload({ e1rmChangePct: -3, avgReadiness: 40, avgSoreness: 4.5 })
    expect(d.severity).toBe('high'); expect(d.loadReductionPct).toEqual([5, 10])
  })
  it('healthy → none', () => expect(detectDeload({ e1rmChangePct: 2, avgReadiness: 80 }).severity).toBe('none'))
  it('low RIR signal', () => expect(detectDeload({ avgRirRecent: 0.1, targetRirMin: 1, avgReadiness: 40 }).shouldDeload).toBe(true))
})

describe('generateWorkout / generateProgram', () => {
  const opts = { goal: 'hypertrophy' as const, level: 'intermediate' as const, sessionMinutes: 60 }
  it('creates the right split per day count', () => {
    expect(generateProgram({ ...opts, days: 3 }).days).toHaveLength(3)
    const p4 = generateProgram({ ...opts, days: 4 })
    expect(p4.days.map(d => d.name)).toEqual(['Upper 1', 'Lower 1', 'Upper 2', 'Lower 2'])
    expect(generateProgram({ ...opts, days: 5 }).days).toHaveLength(5)
    expect(generateProgram({ ...opts, days: 6 }).days.map(d => d.name)).toContain('Pull B')
  })
  it('respects the time budget', () => {
    for (const mins of [45, 60, 75, 90, 120]) {
      const p = generateProgram({ ...opts, days: 4, sessionMinutes: mins })
      for (const d of p.days) expect(d.exercises.length === 3 || estimateMinutes(d.exercises) <= mins).toBe(true)
    }
    const short = generateProgram({ ...opts, days: 4, sessionMinutes: 45 }).days[0].exercises.length
    const long = generateProgram({ ...opts, days: 4, sessionMinutes: 120 }).days[0].exercises.length
    expect(short).toBeLessThan(long)
  })
  it('filters by equipment', () => {
    const d = generateWorkout('x', ['barbell-bench-press', 'machine-chest-press', 'cable-fly'], { ...opts, equipment: ['machine', 'cable'] })
    expect(d.exercises.map(e => e.exerciseId)).toEqual(['machine-chest-press', 'cable-fly'])
  })
  it('compound RIR 1–3, isolation 0–2; strength lowers reps', () => {
    const d = generateWorkout('x', ['back-squat', 'leg-curl'], { ...opts, goal: 'strength' })
    expect(d.exercises[0]).toMatchObject({ rirMin: 1, rirMax: 3, repMin: 3, repMax: 6 })
    expect(d.exercises[1]).toMatchObject({ rirMin: 0, rirMax: 2 })
  })
  it('unknown ids are skipped; every id exists', () => {
    expect(generateWorkout('x', ['nope'], opts).exercises).toEqual([])
    const ids = new Set(SEED_EXERCISES.map(e => e.id))
    for (const days of [3, 4, 5, 6] as const)
      for (const d of generateProgram({ ...opts, days, sessionMinutes: 120 }).days) for (const e of d.exercises) expect(ids.has(e.exerciseId)).toBe(true)
  })
})

describe('periodization', () => {
  it('6-week meso matches the spec profile', () => {
    expect(mesoTarget(1, 6)).toMatchObject({ rirMin: 3, rirMax: 3 })
    expect(mesoTarget(2, 6)).toMatchObject({ rirMin: 2, rirMax: 3 })
    expect(mesoTarget(3, 6)).toMatchObject({ rirMin: 2, rirMax: 2 })
    expect(mesoTarget(4, 6)).toMatchObject({ rirMin: 1, rirMax: 2 })
    expect(mesoTarget(6, 6).deload).toBe(true)
  })
  it('week index cycles', () => {
    expect(mesocycleWeek('2026-01-05', 6, new Date(2026, 0, 5))).toBe(1)
    expect(mesocycleWeek('2026-01-05', 6, new Date(2026, 0, 12))).toBe(2)
    expect(mesocycleWeek('2026-01-05', 6, new Date(2026, 1, 16))).toBe(1)
  })
  it('deload sets never < 2', () => { expect(deloadSets(4)).toBe(3); expect(deloadSets(2)).toBe(2) })
})

describe('bodyWeightStats', () => {
  const day = (n: number) => { const d = new Date(2026, 5, 30); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  const now = new Date(2026, 5, 30)
  it('single weigh-in → no trend', () => {
    const s = bodyWeightStats([{ id: '1', date: day(0), kg: 63 }], now)
    expect(s.weeklyChange).toBeNull(); expect(s.monthlyChange).toBeNull(); expect(s.latest?.kg).toBe(63)
  })
  it('weekly change from window averages', () => {
    const e = [[0, 63.0], [2, 63.2], [4, 63.4], [7, 62.8], [9, 62.6], [11, 62.7]].map(([d, kg], i) => ({ id: String(i), date: day(d), kg }))
    const s = bodyWeightStats(e, now)
    expect(s.avg7?.avg).toBe(63.2); expect(s.weeklyChange).toBe(0.5)
  })
  it('empty', () => expect(bodyWeightStats([], now).latest).toBeUndefined())
})

describe('volume bands', () => {
  it('depend on level', () => {
    expect(setStatus(8, 'beginner')).toBe('optimal')
    expect(setStatus(8, 'advanced')).toBe('low')
    expect(setStatus(20, 'beginner')).toBe('high')
  })
  it('falling performance lowers the ceiling', () => {
    expect(setStatus(17, 'intermediate', 'flat')).toBe('optimal')
    expect(setStatus(17, 'intermediate', 'down')).toBe('high')
  })
  it('hard set rule', () => { expect(isHardSet({ reps: 10, rir: 2 })).toBe(true); expect(isHardSet({ reps: 15, rir: 5 })).toBe(false); expect(isHardSet({ reps: 0 })).toBe(false) })
})
