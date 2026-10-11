import type { ExerciseType, Program } from '../types'
import { daysBetween, parseDate } from './util'

export interface MesoTarget {
  week: number
  total: number
  rirMin: number
  rirMax: number
  deload: boolean
  label: string
}

// Training-week RIR profile from the spec (wk1 RIR 3 → wk2 2–3 → wk3 2 → wk4+ 1–2); sampled for any length.
const PROFILE: [number, number][] = [[3, 3], [2, 3], [2, 2], [1, 2], [1, 2]]

/** Current mesocycle week (1-based). The cycle repeats automatically after the deload week. */
export function mesocycleWeek(startISO: string, totalWeeks: number, now: Date = new Date()): number {
  const total = Math.max(2, Math.round(totalWeeks))
  const days = Math.max(0, daysBetween(parseDate(startISO), now))
  return (Math.floor(days / 7) % total) + 1
}

export function mesoTarget(week: number, total: number): MesoTarget {
  const t = Math.max(2, Math.round(total))
  const w = Math.min(Math.max(1, week), t)
  if (w === t) return { week: w, total: t, rirMin: 3, rirMax: 4, deload: true, label: `Week ${w}/${t} · Deload` }
  const n = t - 1
  const idx = n === 1 ? 0 : Math.round(((w - 1) * (PROFILE.length - 1)) / (n - 1))
  const [rirMin, rirMax] = PROFILE[idx]
  return { week: w, total: t, rirMin, rirMax, deload: false, label: `Week ${w}/${t} · RIR ${rirMin === rirMax ? rirMin : `${rirMin}–${rirMax}`}` }
}

export function currentMeso(program: Pick<Program, 'mesocycleStart' | 'mesocycleWeeks'>, now: Date = new Date()): MesoTarget {
  return mesoTarget(mesocycleWeek(program.mesocycleStart, program.mesocycleWeeks, now), program.mesocycleWeeks)
}

/** Isolation work is taken ~1 RIR closer to failure than compounds (spec: compound 1–3, isolation 0–2). */
export function rirFor(t: MesoTarget, type: ExerciseType): [number, number] {
  return type === 'isolation' ? [Math.max(0, t.rirMin - 1), Math.max(0, t.rirMax - 1)] : [t.rirMin, t.rirMax]
}

/** Deload: ~35 % fewer sets (never below 2). */
export const deloadSets = (sets: number): number => Math.max(2, Math.round(sets * 0.65))
