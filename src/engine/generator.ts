import type { Equipment, Exercise, Goal, Level, PlannedExercise, Program, ProgramDay } from '../types'
import { SEED_EXERCISES } from '../data/exercises'
import { isoDate, uid } from './util'

export interface GenInput {
  goal: Goal
  days: 3 | 4 | 5 | 6
  level: Level
  sessionMinutes: number
  equipment?: Equipment[]
  /** exercise ids to prefer (moved to the front of their day if present) */
  preferred?: string[]
}

// Day templates, in priority order (later exercises are trimmed first when time is short).
const T = {
  fullA: ['back-squat', 'barbell-bench-press', 'seated-cable-row', 'lateral-raise', 'leg-curl', 'triceps-pushdown', 'dumbbell-curl'],
  fullB: ['romanian-deadlift', 'incline-dumbbell-press', 'lat-pulldown', 'dumbbell-shoulder-press', 'leg-extension', 'calf-raise', 'hammer-curl'],
  fullC: ['leg-press', 'dumbbell-bench-press', 'barbell-row', 'cable-lateral-raise', 'hip-thrust', 'overhead-triceps-extension', 'cable-curl'],
  upper1: ['barbell-bench-press', 'barbell-row', 'dumbbell-shoulder-press', 'lat-pulldown', 'cable-fly', 'lateral-raise', 'triceps-pushdown', 'dumbbell-curl'],
  upper2: ['incline-dumbbell-press', 'seated-cable-row', 'overhead-press', 'pull-up', 'rear-delt-fly', 'overhead-triceps-extension', 'hammer-curl'],
  lower1: ['back-squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'calf-raise', 'leg-extension'],
  lower2: ['hack-squat', 'hip-thrust', 'bulgarian-split-squat', 'leg-curl', 'calf-raise', 'leg-extension'],
  pushA: ['barbell-bench-press', 'incline-dumbbell-press', 'dumbbell-shoulder-press', 'lateral-raise', 'cable-fly', 'triceps-pushdown', 'overhead-triceps-extension'],
  pushB: ['overhead-press', 'incline-barbell-bench-press', 'machine-chest-press', 'cable-lateral-raise', 'pec-deck', 'skull-crusher', 'triceps-pushdown'],
  pullA: ['pull-up', 'barbell-row', 'seated-cable-row', 'rear-delt-fly', 'face-pull', 'barbell-curl', 'hammer-curl'],
  pullB: ['lat-pulldown', 'chest-supported-row', 'one-arm-dumbbell-row', 'face-pull', 'rear-delt-fly', 'cable-curl', 'preacher-curl'],
  legsA: ['back-squat', 'romanian-deadlift', 'leg-press', 'leg-curl', 'leg-extension', 'calf-raise'],
  legsB: ['hack-squat', 'hip-thrust', 'bulgarian-split-squat', 'leg-curl', 'leg-extension', 'calf-raise']
} as const

const SPLITS: Record<3 | 4 | 5 | 6, { split: string; days: [string, readonly string[]][] }> = {
  3: { split: 'Full Body', days: [['Full Body A', T.fullA], ['Full Body B', T.fullB], ['Full Body C', T.fullC]] },
  4: { split: 'Upper / Lower', days: [['Upper 1', T.upper1], ['Lower 1', T.lower1], ['Upper 2', T.upper2], ['Lower 2', T.lower2]] },
  5: { split: 'Push / Pull / Legs + Upper / Lower', days: [['Push', T.pushA], ['Pull', T.pullA], ['Legs', T.legsA], ['Upper', T.upper1], ['Lower', T.lower2]] },
  6: { split: 'Push / Pull / Legs x2', days: [['Push A', T.pushA], ['Pull A', T.pullA], ['Legs A', T.legsA], ['Push B', T.pushB], ['Pull B', T.pullB], ['Legs B', T.legsB]] }
}

const BASE_SET_SECONDS = 45
const TRANSITION_SECONDS = 60
const WARMUP_MINUTES = 5

export function estimateMinutes(exercises: PlannedExercise[]): number {
  const secs = exercises.reduce((t, e) => t + e.sets * (BASE_SET_SECONDS + e.restSec) + TRANSITION_SECONDS, 0)
  return Math.round(secs / 60) + WARMUP_MINUTES
}

function plan(ex: Exercise, idx: number, goal: Goal, level: Level): PlannedExercise {
  const compound = ex.type === 'compound'
  const strength = goal === 'strength'
  let sets: number
  if (compound) sets = level === 'beginner' ? 3 : level === 'advanced' && idx === 0 ? 4 : 3
  else sets = level === 'beginner' ? 2 : 3
  let repMin: number, repMax: number
  if (compound) [repMin, repMax] = strength ? [3, 6] : idx === 0 && goal === 'hypertrophy' ? [6, 10] : [8, 12]
  else [repMin, repMax] = strength ? [8, 12] : [10, 15]
  const [rirMin, rirMax] = compound ? [1, 3] : [0, 2]
  const restSec = compound ? (strength ? 240 : idx === 0 ? 180 : 150) : 90
  return { exerciseId: ex.id, sets, repMin, repMax, rirMin, rirMax, restSec, tempo: compound ? '2-0-1-0' : '2-0-1-1' }
}

/** Builds one training day from an ordered id list, filtered by equipment and trimmed to the time budget. */
export function generateWorkout(
  name: string, ids: readonly string[], opts: Pick<GenInput, 'goal' | 'level' | 'sessionMinutes' | 'equipment' | 'preferred'>,
  catalog: Exercise[] = SEED_EXERCISES
): ProgramDay {
  const byId = new Map(catalog.map(e => [e.id, e]))
  const allowed = opts.equipment?.length ? new Set<Equipment>(opts.equipment) : null
  let list = ids.map(id => byId.get(id)).filter((e): e is Exercise => !!e && (!allowed || allowed.has(e.equipment)))
  if (opts.preferred?.length) {
    const pref = new Set(opts.preferred)
    list = [...list.filter(e => pref.has(e.id)), ...list.filter(e => !pref.has(e.id))]
  }
  let planned = list.map((e, i) => plan(e, i, opts.goal, opts.level))
  while (planned.length > 3 && estimateMinutes(planned) > opts.sessionMinutes) planned = planned.slice(0, -1)
  return { id: uid(), name, exercises: planned }
}

export function generateProgram(input: GenInput, catalog: Exercise[] = SEED_EXERCISES, now: Date = new Date()): Program {
  const def = SPLITS[input.days]
  return {
    id: uid(),
    name: `${def.split} · ${input.days} วัน`,
    split: def.split,
    days: def.days.map(([name, ids]) => generateWorkout(name, ids, input, catalog)),
    createdAt: now.toISOString(),
    mesocycleStart: isoDate(now),
    mesocycleWeeks: 6
  }
}
