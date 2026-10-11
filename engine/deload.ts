export interface DeloadSignals {
  /** avg % change of best e1RM across recent exposures (negative = declining) */
  e1rmChangePct?: number
  avgRirRecent?: number
  targetRirMin?: number
  /** consecutive recent weeks with at least one muscle in the "high" volume band */
  highVolumeWeeks?: number
  avgReadiness?: number
  /** 1 (none) … 5 (very sore), recent average */
  avgSoreness?: number
  weeksSinceDeload?: number
}
export interface DeloadAdvice {
  shouldDeload: boolean
  severity: 'none' | 'watch' | 'moderate' | 'high'
  signals: string[]
  volumeReductionPct?: [number, number]
  loadReductionPct?: [number, number]
}

/** Needs ≥ 2 independent fatigue signals; ≥ 3 also suggests lowering load. */
export function detectDeload(s: DeloadSignals): DeloadAdvice {
  const signals: string[] = []
  if (s.e1rmChangePct !== undefined && s.e1rmChangePct <= -2)
    signals.push(`Performance ลดลงต่อเนื่อง (e1RM ${s.e1rmChangePct.toFixed(1)}%)`)
  if (s.avgRirRecent !== undefined && s.targetRirMin !== undefined && s.avgRirRecent < s.targetRirMin - 0.5)
    signals.push(`RIR เฉลี่ยต่ำผิดปกติ (${s.avgRirRecent.toFixed(1)} vs เป้า ≥ ${s.targetRirMin})`)
  if (s.highVolumeWeeks !== undefined && s.highVolumeWeeks >= 2)
    signals.push(`Volume อยู่ในระดับสูงต่อเนื่อง ${s.highVolumeWeeks} สัปดาห์`)
  if (s.avgReadiness !== undefined && s.avgReadiness < 55)
    signals.push(`Readiness เฉลี่ยต่ำ (${Math.round(s.avgReadiness)}%)`)
  if (s.avgSoreness !== undefined && s.avgSoreness >= 4)
    signals.push(`อาการล้า/ปวดเมื่อยสูง (${s.avgSoreness.toFixed(1)}/5)`)
  if (s.weeksSinceDeload !== undefined && s.weeksSinceDeload >= 8)
    signals.push(`ไม่ได้ deload มา ${s.weeksSinceDeload} สัปดาห์`)

  const n = signals.length
  if (n >= 3) return { shouldDeload: true, severity: 'high', signals, volumeReductionPct: [30, 40], loadReductionPct: [5, 10] }
  if (n === 2) return { shouldDeload: true, severity: 'moderate', signals, volumeReductionPct: [30, 40] }
  return { shouldDeload: false, severity: n === 1 ? 'watch' : 'none', signals }
}
