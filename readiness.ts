import type { ReadinessAdvice, ReadinessInput, ReadinessLog } from '../types'

/** Neutral answers (all 3s) score 50 and still "proceed". */
export const READINESS_THRESHOLDS = { proceed: 50, reduceLoad: 35 } as const

const norm = (v: number) => (v - 1) / 4

/** Sleep & energy: higher is better. Soreness & stress: higher is worse. Returns null on invalid input. */
export function calculateReadiness(i: ReadinessInput): ReadinessLog | null {
  const vals = [i.sleep, i.energy, i.soreness, i.stress]
  if (vals.some(v => !Number.isFinite(v) || v < 1 || v > 5)) return null
  const score = Math.round(100 * (0.3 * norm(i.sleep) + 0.3 * norm(i.energy) + 0.2 * (1 - norm(i.soreness)) + 0.2 * (1 - norm(i.stress))))
  const advice: ReadinessAdvice =
    score >= READINESS_THRESHOLDS.proceed ? 'proceed' : score >= READINESS_THRESHOLDS.reduceLoad ? 'reduce_volume' : 'reduce_load'
  return { ...i, score, advice }
}

export const READINESS_TEXT: Record<ReadinessAdvice, string> = {
  proceed: 'ฝึกตามแผน',
  reduce_volume: 'ลดปริมาณ (ลด 1 เซ็ตต่อท่า)',
  reduce_load: 'ลดน้ำหนัก ~7.5% และเน้นเทคนิค'
}
