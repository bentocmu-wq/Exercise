import type { ExerciseType, ProgressionAction, Recommendation } from '../types'
import { fmtKg, mean, round } from './util'
import { READINESS_THRESHOLDS } from './readiness'

export interface ProgressionSet { weight: number; reps: number; rir?: number }

export interface ProgressionInput {
  /** sets from the most recent session of this exercise */
  previousSets: ProgressionSet[]
  targetRepMin: number
  targetRepMax: number
  targetRirMin: number
  targetRirMax: number
  exerciseType: ExerciseType
  /** smallest load jump (kg) */
  increment: number
  plannedSets?: number
  /** today's readiness 0–100 (optional) */
  readinessScore?: number | null
  painFlag?: boolean
  painNote?: string
}

export type { Recommendation }

export function roundToIncrement(value: number, inc: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  if (!(inc > 0)) return value
  const q = value / inc
  const r = mode === 'down' ? Math.floor(q + 1e-9) : mode === 'up' ? Math.ceil(q - 1e-9) : Math.round(q)
  return Math.round(r * inc * 1000) / 1000
}

const fmtSet = (s: ProgressionSet) => `${fmtKg(s.weight)} kg × ${s.reps}${s.rir !== undefined ? ` (RIR ${s.rir})` : ''}`

/**
 * Double progression with RIR awareness.
 *  - every working set at the top of the rep range (and RIR not below target) → add load
 *  - most sets under the rep range (or failure + clear shortfall)        → reduce 5–10 %
 *  - otherwise                                                            → hold, chase more reps
 * Pain flag, low readiness and missing data are handled explicitly – no blind progression.
 */
export function calculateNextWeight(input: ProgressionInput): Recommendation {
  const { targetRepMin: repMin, targetRepMax: repMax, targetRirMin: rirMin, targetRirMax: rirMax, exerciseType, increment: inc } = input
  const prev = input.previousSets.filter(s => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.weight >= 0)
  const valid = prev.filter(s => s.reps > 0)
  const evidence = prev.map(fmtSet)

  if (prev.length === 0) {
    return {
      recommendedWeight: null, action: 'START', confidence: 'low', evidence,
      reason: `ยังไม่มีประวัติท่านี้ — เลือกน้ำหนักที่ทำได้ ${repMin}–${repMax} reps โดยเหลือประมาณ ${rirMin}–${rirMax} reps (RIR)`
    }
  }

  const topAll = Math.max(...prev.map(s => s.weight))

  if (input.painFlag) {
    return {
      recommendedWeight: topAll, action: 'HOLD', confidence: 'low', evidence,
      reason: 'Session ก่อนมีการบันทึกอาการปวดในท่านี้ จึงไม่เพิ่มน้ำหนักอัตโนมัติจนกว่าจะประเมินใหม่',
      warning: `มีการบันทึกอาการปวด${input.painNote ? `: "${input.painNote}"` : ''} — ลองใช้น้ำหนักเบาลง ปรับท่า/ช่วงการเคลื่อนไหว หรือเปลี่ยนท่า หากปวดต่อเนื่องควรหยุดและพิจารณาปรึกษาผู้เชี่ยวชาญ`
    }
  }

  if (valid.length === 0) {
    const w = Math.max(0, roundToIncrement(topAll - inc, inc))
    return {
      recommendedWeight: w, action: 'DECREASE', confidence: 'medium', evidence,
      reason: `Session ก่อนทำที่ ${fmtKg(topAll)} kg ไม่สำเร็จ (0 reps) — ลดลงหนึ่งขั้นเพื่อกลับมาทำได้ครบช่วง ${repMin}–${repMax} reps`,
      nextRepTarget: `ตั้งเป้า ${repMin}–${repMax} reps`
    }
  }

  const top = Math.max(...valid.map(s => s.weight))
  const working = valid.filter(s => s.weight >= top * 0.95)
  const n = working.length
  const planned = input.plannedSets ?? n
  const minReps = Math.min(...working.map(s => s.reps))
  const rirs = working.filter(s => s.rir !== undefined && Number.isFinite(s.rir)).map(s => s.rir as number)
  const avgRir = rirs.length ? mean(rirs) : undefined
  const rirText = avgRir !== undefined ? `โดยเหลือประมาณ ${round(avgRir, 1)} reps` : '(ยังไม่ได้บันทึก RIR)'
  const belowCount = working.filter(s => s.reps < repMin).length
  const shortfall = repMin - minReps
  const allAtTop = n >= planned && working.every(s => s.reps >= repMax)

  let action: ProgressionAction = 'HOLD'
  let weight = top
  let reason = ''
  let nextRepTarget: string | undefined

  if (shortfall >= 2 && (belowCount >= Math.ceil(n / 2) || belowCount === n || (avgRir !== undefined && avgRir <= 0.5))) {
    const belowReps = working.filter(s => s.reps < repMin).map(s => s.reps)
    const pct = repMin - mean(belowReps) >= 4 ? 0.1 : 0.05
    let w = roundToIncrement(top * (1 - pct), inc)
    if (w >= top) w = top - inc
    weight = Math.max(0, w)
    action = 'DECREASE'
    reason = `ลดน้ำหนัก ~${pct * 100}% เพราะที่ ${fmtKg(top)} kg ทำได้ต่ำกว่าช่วง ${repMin}–${repMax} reps (${belowCount}/${n} เซ็ต, ต่ำสุด ${minReps} reps)${avgRir !== undefined && avgRir <= 0.5 ? ' และเกือบหมดแรงทุกเซ็ต (RIR ≈ 0)' : ''}`
    nextRepTarget = `ตั้งเป้า ${repMin}–${repMax} reps ที่น้ำหนักใหม่`
  } else if (allAtTop && avgRir !== undefined && avgRir < Math.min(rirMin, 1)) {
    // Grinding every set to (near) failure: the top-of-range reps were too costly to build on yet.
    reason = `ทำถึง ${repMax} reps ทุกเซ็ตแล้ว แต่ RIR เฉลี่ย ${round(avgRir, 1)} (เกือบหมดแรงทุกเซ็ต, เป้า ${rirMin}–${rirMax}) — คงน้ำหนักเดิมและทำซ้ำให้เหลือ RIR ≥ 1 ก่อนเพิ่ม`
    nextRepTarget = `ทำทุกเซ็ต ${repMax} reps ที่ RIR ≥ 1`
  } else if (allAtTop) {
    const steps = exerciseType === 'compound' && avgRir !== undefined && avgRir >= rirMax + 2 ? 2 : 1
    weight = roundToIncrement(top + steps * inc, inc)
    action = 'INCREASE'
    reason = `เพิ่มน้ำหนักได้ เพราะคุณทำครบ ${n} sets ที่ ${repMax} reps (สูงสุดของช่วง ${repMin}–${repMax}) ที่ ${fmtKg(top)} kg ${rirText}${steps === 2 ? ' — RIR สูงกว่าเป้าชัดเจน จึงเพิ่ม 2 ขั้น' : ''}`
    nextRepTarget = `เริ่มที่ ${repMin} reps แล้วไต่กลับไปที่ ${repMax}`
  } else if (minReps >= repMin && avgRir !== undefined && avgRir >= rirMax + 2) {
    weight = roundToIncrement(top + inc, inc)
    action = 'INCREASE'
    reason = `เพิ่มน้ำหนักได้ เพราะทำได้ในช่วง ${repMin}–${repMax} reps แต่ยังเหลือ ~${round(avgRir, 1)} reps (เป้า ${rirMin}–${rirMax}) แปลว่าน้ำหนักยังเบาเกินไป`
    nextRepTarget = `ตั้งเป้า ${repMin}–${repMax} reps ที่น้ำหนักใหม่`
  } else {
    const target = Math.min(repMax, minReps + 1)
    reason = n < planned
      ? `คงน้ำหนัก ${fmtKg(top)} kg — Session ก่อนทำ ${n}/${planned} เซ็ต ให้ทำให้ครบก่อน`
      : `คงน้ำหนัก ${fmtKg(top)} kg — ยังไม่ครบ ${repMax} reps ทุกเซ็ต (ต่ำสุด ${minReps} reps) ตามหลัก double progression ให้เพิ่ม reps ก่อนเพิ่มน้ำหนัก`
    nextRepTarget = `พยายามให้ทุกเซ็ตได้ ${target}+ reps`
  }

  // Readiness gate (today's state beats yesterday's numbers)
  const r = input.readinessScore
  if (r !== null && r !== undefined && Number.isFinite(r)) {
    if (r < READINESS_THRESHOLDS.reduceLoad && action !== 'DECREASE') {
      const w = Math.max(0, roundToIncrement(top * 0.925, inc))
      weight = w >= top ? Math.max(0, top - inc) : w
      reason = `Readiness วันนี้ต่ำ (${Math.round(r)}%) — ลดน้ำหนักเหลือ ${fmtKg(weight)} kg (~7.5%) แล้วเน้นเทคนิค | เดิม: ${reason}`
      action = 'DECREASE'
    } else if (r < READINESS_THRESHOLDS.proceed && action === 'INCREASE') {
      weight = top
      action = 'HOLD'
      reason = `Readiness วันนี้ไม่สูง (${Math.round(r)}%) — ยังไม่เพิ่มน้ำหนัก คงที่ ${fmtKg(top)} kg ก่อน | เดิม: ${reason}`
    }
  }

  const confidence: Recommendation['confidence'] = rirs.length === n && n >= 3 ? 'high' : n >= 2 ? 'medium' : 'low'
  return { recommendedWeight: weight, action, reason, confidence, nextRepTarget, evidence }
}
