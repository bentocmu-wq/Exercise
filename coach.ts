import type { PlannedExercise, SetLog } from '../types'
import { calculateE1RM } from './e1rm'
import { calculateNextWeight } from './progression'
import { fmtKg } from './util'

/** Post-exercise coaching message: what happened + what to do next time, with reasons. */
export function coachSummary(
  name: string, sets: SetLog[], planned: PlannedExercise,
  opts: { type: 'compound' | 'isolation'; increment: number; painFlag: boolean }
): string {
  const done = sets.filter(s => s.reps > 0)
  if (!done.length) return `${name}: ยังไม่มีเซ็ตที่บันทึก`
  const best = done.reduce((a, b) => (calculateE1RM(b.weight, b.reps) > calculateE1RM(a.weight, a.reps) ? b : a))
  const next = calculateNextWeight({
    previousSets: sets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir })),
    targetRepMin: planned.repMin, targetRepMax: planned.repMax,
    targetRirMin: planned.rirMin, targetRirMax: planned.rirMax,
    exerciseType: opts.type, increment: opts.increment, plannedSets: planned.sets, painFlag: opts.painFlag
  })
  const rirPart = best.rir !== undefined ? ` ที่ RIR ${best.rir}` : ''
  const head = best.rir !== undefined && best.rir <= 2 && best.reps >= planned.repMin ? 'Strong set.' : 'Logged.'
  const nextW = next.recommendedWeight !== null ? `${fmtKg(next.recommendedWeight)} kg` : 'น้ำหนักที่เหมาะกับคุณ'
  return `${head} คุณทำ ${fmtKg(best.weight)} kg × ${best.reps}${rirPart}\nNext session แนะนำ ${nextW}${next.nextRepTarget ? ` — ${next.nextRepTarget}` : ''}\nเหตุผล: ${next.reason}`
}
