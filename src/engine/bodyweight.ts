import type { BodyWeightEntry } from '../types'
import { addDays, mean, parseDate, round } from './util'

export interface WindowAvg { avg: number; count: number }

/** Average of entries in (end − days, end]. */
export function windowAverage(entries: BodyWeightEntry[], end: Date, days: number): WindowAvg | null {
  const hi = addDays(end, 1).getTime()
  const lo = addDays(end, 1 - days).getTime()
  const xs = entries.filter(e => { const t = parseDate(e.date).getTime(); return t >= lo && t < hi }).map(e => e.kg)
  return xs.length ? { avg: round(mean(xs), 2), count: xs.length } : null
}

export interface BodyWeightStats {
  latest?: BodyWeightEntry
  avg7?: WindowAvg
  weeklyChange: number | null
  monthlyChange: number | null
  note?: string
}

/**
 * Trends use averages over windows – a single weigh-in is never interpreted.
 * Weekly change needs ≥ 2 entries in each of the last two 7-day windows; monthly needs ≥ 3 in each 30-day window.
 */
export function bodyWeightStats(entries: BodyWeightEntry[], now: Date = new Date()): BodyWeightStats {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const avg7 = windowAverage(sorted, now, 7) ?? undefined
  const cur7 = windowAverage(sorted, now, 7)
  const prev7 = windowAverage(sorted, addDays(now, -7), 7)
  const cur30 = windowAverage(sorted, now, 30)
  const prev30 = windowAverage(sorted, addDays(now, -30), 30)
  const weeklyChange = cur7 && prev7 && cur7.count >= 2 && prev7.count >= 2 ? round(cur7.avg - prev7.avg, 2) : null
  const monthlyChange = cur30 && prev30 && cur30.count >= 3 && prev30.count >= 3 ? round(cur30.avg - prev30.avg, 2) : null
  const note = !latest ? undefined
    : weeklyChange === null ? 'ยังดูแนวโน้มรายสัปดาห์ไม่ได้ — ต้องมีอย่างน้อย 2 ครั้งในแต่ละสัปดาห์ (ไม่ตีความจากน้ำหนักวันเดียว)' : undefined
  return { latest, avg7, weeklyChange, monthlyChange, note }
}

export const strengthToWeight = (e1rm: number, bodyKg: number): number | null =>
  e1rm > 0 && bodyKg > 0 ? round(e1rm / bodyKg, 2) : null
