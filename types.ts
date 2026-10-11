export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'quads' | 'hamstrings'
  | 'glutes' | 'biceps' | 'triceps' | 'calves'

export const MUSCLES: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves'
]
export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'อก', back: 'หลัง', shoulders: 'ไหล่', quads: 'ต้นขาหน้า', hamstrings: 'ต้นขาหลัง',
  glutes: 'สะโพก', biceps: 'ไบเซป', triceps: 'ไตรเซป', calves: 'น่อง'
}

export type ExerciseType = 'compound' | 'isolation'
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
export const EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight']

export interface Exercise {
  id: string
  name: string
  primary: MuscleGroup
  secondary: MuscleGroup[]
  type: ExerciseType
  equipment: Equipment
  /** smallest load jump in kg (user-overridable per planned exercise) */
  increment: number
  custom?: boolean
}

export type Goal = 'hypertrophy' | 'strength' | 'fat_loss' | 'recomp' | 'general'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Sex = 'male' | 'female' | 'other'

export interface Profile {
  age: number
  sex: Sex
  heightCm: number
  bodyWeightKg: number
  goal: Goal
  level: Level
  daysPerWeek: 3 | 4 | 5 | 6
  sessionMinutes: 45 | 60 | 75 | 90 | 120
  equipment: Equipment[]
}

export interface PlannedExercise {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  rirMin: number
  rirMax: number
  restSec: number
  tempo?: string
  /** overrides Exercise.increment when set */
  increment?: number
}

export interface ProgramDay {
  id: string
  name: string
  exercises: PlannedExercise[]
}

export interface Program {
  id: string
  name: string
  split: string
  days: ProgramDay[]
  createdAt: string
  mesocycleStart: string
  mesocycleWeeks: number
}

export interface SetLog {
  id: string
  setNumber: number
  weight: number
  reps: number
  rir?: number
  rpe?: number
  restTime?: number
  timestamp: string
  notes?: string
}

export type ProgressionAction = 'START' | 'INCREASE' | 'HOLD' | 'DECREASE'
export interface Recommendation {
  recommendedWeight: number | null
  action: ProgressionAction
  reason: string
  confidence: 'high' | 'medium' | 'low'
  nextRepTarget?: string
  evidence: string[]
  warning?: string
}

export interface SessionExercise {
  exerciseId: string
  planned: PlannedExercise
  sets: SetLog[]
  completed: boolean
  painFlag: boolean
  painNote?: string
  /** free-text notes, kept separate from performance data */
  notes?: string
  recommendation: Recommendation
}

export type ReadinessAdvice = 'proceed' | 'reduce_volume' | 'reduce_load'
export interface ReadinessInput { sleep: number; energy: number; soreness: number; stress: number }
export interface ReadinessLog extends ReadinessInput { score: number; advice: ReadinessAdvice }

export interface Session {
  id: string
  programDayId: string
  name: string
  startedAt: string
  endedAt?: string
  readiness?: ReadinessLog
  exercises: SessionExercise[]
  deload: boolean
  mesoLabel?: string
}

export interface BodyWeightEntry { id: string; date: string; kg: number }

export type PRKind = 'weight' | 'reps' | 'e1rm' | 'volume'
export interface PersonalRecord {
  id: string
  exerciseId: string
  kind: PRKind
  value: number
  weight: number
  reps: number
  date: string
  sessionId: string
}
