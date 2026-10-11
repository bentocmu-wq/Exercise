export interface VolumeSet { weight: number; reps: number }

/** Volume load = Σ weight × reps over the sets (= weight × reps × sets for uniform sets). */
export function calculateVolume(sets: VolumeSet[]): number {
  let total = 0
  for (const s of sets) {
    if (Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.weight > 0 && s.reps > 0) total += s.weight * s.reps
  }
  return Math.round(total * 100) / 100
}
