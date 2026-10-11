import type { PRKind } from '../types'
import { calculateE1RM, E1RM_MAX_REPS } from './e1rm'

export interface PriorSet { weight: number; reps: number }

/**
 * Set-level PRs against everything done before (history + earlier sets today).
 * The very first time an exercise is logged is NOT a PR (no baseline).
 *  - weight: heaviest load ever
 *  - reps:   most reps at this load or heavier
 *  - e1rm:   best Epley estimate (sets ≤ 12 reps)
 */
export function detectPR(set: PriorSet, prior: PriorSet[]): PRKind[] {
  const valid = prior.filter(p => p.reps > 0 && p.weight >= 0)
  if (!valid.length || !(set.reps > 0) || !(set.weight >= 0)) return []
  const out: PRKind[] = []
  if (set.weight > 0 && set.weight > Math.max(...valid.map(p => p.weight))) out.push('weight')
  const heavier = valid.filter(p => p.weight >= set.weight)
  if (heavier.length && set.reps > Math.max(...heavier.map(p => p.reps))) out.push('reps')
  if (set.reps <= E1RM_MAX_REPS) {
    const cur = calculateE1RM(set.weight, set.reps)
    const best = Math.max(0, ...valid.filter(p => p.reps <= E1RM_MAX_REPS).map(p => calculateE1RM(p.weight, p.reps)))
    if (cur > 0 && best > 0 && cur > best) out.push('e1rm')
  }
  return out
}

/** Exercise volume in one session vs. best previous session volume. */
export function detectVolumePR(current: number, priorSessionVolumes: number[]): boolean {
  const prior = priorSessionVolumes.filter(v => v > 0)
  return current > 0 && prior.length > 0 && current > Math.max(...prior)
}

export const PR_LABEL: Record<PRKind, string> = {
  weight: 'น้ำหนักสูงสุด', reps: 'Rep PR', e1rm: 'e1RM ใหม่', volume: 'Volume สูงสุด'
}
