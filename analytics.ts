import type { Exercise, Level, MuscleGroup, Profile, Session, SetLog } from '../types'
import { MUSCLES } from '../types'
import { calculateE1RM, E1RM_MAX_REPS } from './e1rm'
import { calculateVolume } from './volume'
import { addDays, isoDate, mean, parseDate, round, startOfWeek } from './util'
import type { DeloadSignals } from './deload'

export const finished = (sessions: Session[]): Session[] => sessions.filter(s => s.endedAt)
const sessionDate = (s: Session) => parseDate(s.startedAt)

export const sessionSets = (s: Session): SetLog[] => s.exercises.flatMap(e => e.sets)
export const sessionVolume = (s: Session): number => calculateVolume(sessionSets(s))
export function sessionAvgRir(s: Session): number | undefined {
  const r = sessionSets(s).filter(x => x.rir !== undefined).map(x => x.rir as number)
  return r.length ? round(mean(r), 1) : undefined
}
export const sessionMinutes = (s: Session): number | undefined =>
  s.endedAt ? Math.max(1, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)) : undefined

/* ---------- exercise history ---------- */
export interface ExerciseHistoryRow {
  sessionId: string
  date: string
  sets: SetLog[]
  topWeight: number
  volume: number
  e1rm: number
  avgRir?: number
}
export function exerciseHistory(sessions: Session[], exerciseId: string): ExerciseHistoryRow[] {
  const rows: ExerciseHistoryRow[] = []
  for (const s of finished(sessions)) {
    const ex = s.exercises.find(e => e.exerciseId === exerciseId)
    if (!ex || !ex.sets.length) continue
    const rirs = ex.sets.filter(x => x.rir !== undefined).map(x => x.rir as number)
    rows.push({
      sessionId: s.id,
      date: s.startedAt,
      sets: ex.sets,
      topWeight: Math.max(...ex.sets.map(x => x.weight)),
      volume: calculateVolume(ex.sets),
      e1rm: Math.max(0, ...ex.sets.filter(x => x.reps <= E1RM_MAX_REPS).map(x => calculateE1RM(x.weight, x.reps))),
      avgRir: rirs.length ? round(mean(rirs), 1) : undefined
    })
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------- weekly volume & hard sets ---------- */
export function weeklyVolume(sessions: Session[], weeks: number, now: Date = new Date()): { weekStart: string; volume: number }[] {
  const first = addDays(startOfWeek(now), -7 * (weeks - 1))
  const out = Array.from({ length: weeks }, (_, i) => ({ weekStart: isoDate(addDays(first, i * 7)), volume: 0 }))
  for (const s of finished(sessions)) {
    const idx = Math.floor((startOfWeek(sessionDate(s)).getTime() - first.getTime()) / (7 * 86_400_000) + 0.01)
    if (idx >= 0 && idx < weeks) out[idx].volume += sessionVolume(s)
  }
  return out.map(o => ({ ...o, volume: Math.round(o.volume) }))
}

export const isHardSet = (s: { reps: number; rir?: number }): boolean =>
  s.reps > 0 && (s.rir === undefined ? s.reps >= 5 : s.rir <= 3)

type ExMap = Map<string, Exercise>
const inWeek = (s: Session, weekStart: Date) => {
  const t = sessionDate(s).getTime()
  return t >= weekStart.getTime() && t < addDays(weekStart, 7).getTime()
}

/** Hard sets per muscle for a week (primary = 1, secondary = 0.5). */
export function weeklyHardSets(sessions: Session[], ex: ExMap, weekStart: Date): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0])) as Record<MuscleGroup, number>
  for (const s of finished(sessions).filter(x => inWeek(x, weekStart))) {
    for (const e of s.exercises) {
      const def = ex.get(e.exerciseId)
      if (!def) continue
      const hard = e.sets.filter(isHardSet).length
      out[def.primary] += hard
      for (const m of def.secondary) out[m] += hard * 0.5
    }
  }
  return out
}
export function weeklyMuscleVolume(sessions: Session[], ex: ExMap, weekStart: Date): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLES.map(m => [m, 0])) as Record<MuscleGroup, number>
  for (const s of finished(sessions).filter(x => inWeek(x, weekStart)))
    for (const e of s.exercises) {
      const def = ex.get(e.exerciseId)
      if (def) out[def.primary] += calculateVolume(e.sets)
    }
  return out
}

export type SetStatus = 'low' | 'optimal' | 'high'
// Weekly hard-set bands by training level – guidance, not law.
const BANDS: Record<Level, [number, number, number]> = {
  beginner: [4, 8, 12],       // <4 low · 4–12 optimal · >12 high   (opt min, comfortable, max)
  intermediate: [8, 12, 18],
  advanced: [10, 15, 22]
}
export function setStatus(sets: number, level: Level, trend: 'up' | 'flat' | 'down' = 'flat'): SetStatus {
  const [lo, , hi] = BANDS[level]
  // A user whose performance is falling should be judged against a lower ceiling.
  const ceiling = trend === 'down' ? hi * 0.85 : trend === 'up' ? hi * 1.1 : hi
  if (sets < lo) return 'low'
  if (sets > ceiling) return 'high'
  return 'optimal'
}
export const bandText = (level: Level): string => `${BANDS[level][0]}–${BANDS[level][2]} sets`

/** Trend of best e1RM per muscle's primary lifts over recent exposures. */
export function muscleTrend(sessions: Session[], ex: ExMap, muscle: MuscleGroup): 'up' | 'flat' | 'down' {
  const changes: number[] = []
  for (const [id, def] of ex) {
    if (def.primary !== muscle) continue
    const h = exerciseHistory(sessions, id).slice(-3).filter(r => r.e1rm > 0)
    if (h.length >= 3) changes.push((h[h.length - 1].e1rm - h[0].e1rm) / h[0].e1rm)
  }
  if (!changes.length) return 'flat'
  const c = mean(changes)
  return c > 0.01 ? 'up' : c < -0.01 ? 'down' : 'flat'
}

/* ---------- consistency ---------- */
export function sessionsInWeek(sessions: Session[], now: Date = new Date()): number {
  const ws = startOfWeek(now)
  return finished(sessions).filter(s => inWeek(s, ws)).length
}
/** Consecutive weeks (back from this one) with ≥ max(1, days−1) sessions; the current week can't break it yet. */
export function trainingStreakWeeks(sessions: Session[], profile: Pick<Profile, 'daysPerWeek'> | undefined, now: Date = new Date()): number {
  const need = Math.max(1, (profile?.daysPerWeek ?? 3) - 1)
  const done = finished(sessions)
  const count = (ws: Date) => done.filter(s => inWeek(s, ws)).length
  let ws = startOfWeek(now)
  let streak = 0
  if (count(ws) >= need) streak++
  ws = addDays(ws, -7)
  for (let i = 0; i < 260; i++) {
    if (count(ws) >= need) streak++
    else break
    ws = addDays(ws, -7)
  }
  return streak
}

/* ---------- deload inputs from real data ---------- */
export function computeDeloadSignals(
  sessions: Session[], ex: ExMap, profile: Profile | undefined, program: { mesocycleStart: string } | undefined, now: Date = new Date()
): DeloadSignals {
  const done = finished(sessions)
  const recent = done.filter(s => now.getTime() - sessionDate(s).getTime() <= 28 * 86_400_000)
  const s: DeloadSignals = {}

  const changes: number[] = []
  for (const id of new Set(recent.flatMap(r => r.exercises.map(e => e.exerciseId)))) {
    const h = exerciseHistory(recent, id).slice(-3).filter(r => r.e1rm > 0)
    if (h.length >= 3) changes.push(((h[h.length - 1].e1rm - h[0].e1rm) / h[0].e1rm) * 100)
  }
  if (changes.length >= 2) s.e1rmChangePct = mean(changes)

  const last3 = done.slice(-3)
  const rirs = last3.flatMap(sessionSets).filter(x => x.rir !== undefined).map(x => x.rir as number)
  if (rirs.length >= 6) {
    s.avgRirRecent = mean(rirs)
    const mins = last3.flatMap(r => r.exercises.filter(e => ex.get(e.exerciseId)?.type === 'compound').map(e => e.planned.rirMin))
    s.targetRirMin = mins.length ? mean(mins) : 1
  }

  if (profile) {
    let high = 0
    for (let i = 0; i < 3; i++) {
      const ws = addDays(startOfWeek(now), -7 * i)
      const hs = weeklyHardSets(done, ex, ws)
      if (MUSCLES.some(m => setStatus(hs[m], profile.level) === 'high')) high++
      else break
    }
    s.highVolumeWeeks = high
  }

  const ready = done.slice(-4).map(r => r.readiness?.score).filter((x): x is number => x !== undefined)
  if (ready.length >= 2) s.avgReadiness = mean(ready)
  const sore = done.slice(-4).map(r => r.readiness?.soreness).filter((x): x is number => x !== undefined)
  if (sore.length >= 2) s.avgSoreness = mean(sore)

  if (program && done.length >= 8) {
    const deloads = done.filter(r => r.deload)
    const ref = deloads.length ? sessionDate(deloads[deloads.length - 1]) : parseDate(program.mesocycleStart)
    s.weeksSinceDeload = Math.floor((now.getTime() - ref.getTime()) / (7 * 86_400_000))
  }
  return s
}
