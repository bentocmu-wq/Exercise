import type { Equipment, Exercise, ExerciseType, MuscleGroup } from '../types'

export const DEFAULT_INCREMENT: Record<Equipment, number> = {
  barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, bodyweight: 2.5
}

const ex = (
  id: string, name: string, primary: MuscleGroup, type: ExerciseType,
  equipment: Equipment, secondary: MuscleGroup[] = []
): Exercise => ({ id, name, primary, secondary, type, equipment, increment: DEFAULT_INCREMENT[equipment] })

export const SEED_EXERCISES: Exercise[] = [
  // Chest
  ex('barbell-bench-press', 'Barbell Bench Press', 'chest', 'compound', 'barbell', ['triceps', 'shoulders']),
  ex('incline-barbell-bench-press', 'Incline Barbell Bench Press', 'chest', 'compound', 'barbell', ['triceps', 'shoulders']),
  ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'compound', 'dumbbell', ['triceps', 'shoulders']),
  ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'compound', 'dumbbell', ['triceps', 'shoulders']),
  ex('machine-chest-press', 'Machine Chest Press', 'chest', 'compound', 'machine', ['triceps', 'shoulders']),
  ex('cable-fly', 'Cable Fly', 'chest', 'isolation', 'cable'),
  ex('pec-deck', 'Pec Deck', 'chest', 'isolation', 'machine'),
  // Back
  ex('pull-up', 'Pull Up', 'back', 'compound', 'bodyweight', ['biceps']),
  ex('lat-pulldown', 'Lat Pulldown', 'back', 'compound', 'cable', ['biceps']),
  ex('barbell-row', 'Barbell Row', 'back', 'compound', 'barbell', ['biceps']),
  ex('seated-cable-row', 'Seated Cable Row', 'back', 'compound', 'cable', ['biceps']),
  ex('chest-supported-row', 'Chest Supported Row', 'back', 'compound', 'machine', ['biceps']),
  ex('one-arm-dumbbell-row', 'One Arm Dumbbell Row', 'back', 'compound', 'dumbbell', ['biceps']),
  ex('machine-row', 'Machine Row', 'back', 'compound', 'machine', ['biceps']),
  // Shoulders
  ex('overhead-press', 'Overhead Press', 'shoulders', 'compound', 'barbell', ['triceps']),
  ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'compound', 'dumbbell', ['triceps']),
  ex('machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', 'compound', 'machine', ['triceps']),
  ex('lateral-raise', 'Lateral Raise', 'shoulders', 'isolation', 'dumbbell'),
  ex('cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', 'isolation', 'cable'),
  ex('rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'isolation', 'dumbbell'),
  ex('face-pull', 'Face Pull', 'shoulders', 'isolation', 'cable', ['back']),
  // Legs
  ex('back-squat', 'Back Squat', 'quads', 'compound', 'barbell', ['glutes', 'hamstrings']),
  ex('front-squat', 'Front Squat', 'quads', 'compound', 'barbell', ['glutes']),
  ex('leg-press', 'Leg Press', 'quads', 'compound', 'machine', ['glutes']),
  ex('hack-squat', 'Hack Squat', 'quads', 'compound', 'machine', ['glutes']),
  ex('romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'compound', 'barbell', ['glutes', 'back']),
  ex('conventional-deadlift', 'Conventional Deadlift', 'hamstrings', 'compound', 'barbell', ['glutes', 'back', 'quads']),
  ex('leg-curl', 'Leg Curl', 'hamstrings', 'isolation', 'machine'),
  ex('leg-extension', 'Leg Extension', 'quads', 'isolation', 'machine'),
  ex('bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'compound', 'dumbbell', ['glutes']),
  ex('hip-thrust', 'Hip Thrust', 'glutes', 'compound', 'barbell', ['hamstrings']),
  ex('calf-raise', 'Calf Raise', 'calves', 'isolation', 'machine'),
  // Arms
  ex('barbell-curl', 'Barbell Curl', 'biceps', 'isolation', 'barbell'),
  ex('dumbbell-curl', 'Dumbbell Curl', 'biceps', 'isolation', 'dumbbell'),
  ex('hammer-curl', 'Hammer Curl', 'biceps', 'isolation', 'dumbbell'),
  ex('preacher-curl', 'Preacher Curl', 'biceps', 'isolation', 'machine'),
  ex('cable-curl', 'Cable Curl', 'biceps', 'isolation', 'cable'),
  ex('triceps-pushdown', 'Triceps Pushdown', 'triceps', 'isolation', 'cable'),
  ex('skull-crusher', 'Skull Crusher', 'triceps', 'isolation', 'barbell'),
  ex('overhead-triceps-extension', 'Overhead Triceps Extension', 'triceps', 'isolation', 'cable'),
  ex('dips', 'Dips', 'triceps', 'compound', 'bodyweight', ['chest', 'shoulders'])
]

/** Lifts shown on the Strength (e1RM) screen, if the user has logged them. */
export const MAIN_LIFTS = ['barbell-bench-press', 'back-squat', 'conventional-deadlift', 'overhead-press']
