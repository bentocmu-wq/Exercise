import { round } from './util'

/** Epley: e1RM = w × (1 + reps/30). A single rep is its own 1RM. Invalid input → 0. */
export function calculateE1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return round(weight * (1 + reps / 30), 1)
}
/** Estimates get unreliable at high reps; PR/trend logic ignores sets above this. */
export const E1RM_MAX_REPS = 12
