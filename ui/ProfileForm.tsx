import { useState } from 'react'
import type { Equipment, Goal, Level, Profile, Sex } from '../types'
import { EQUIPMENT } from '../types'
import { Chips, NumField } from './kit'

export const DEFAULT_PROFILE: Profile = {
  age: 28, sex: 'male', heightCm: 172, bodyWeightKg: 70, goal: 'hypertrophy', level: 'intermediate',
  daysPerWeek: 4, sessionMinutes: 75, equipment: [...EQUIPMENT]
}

export function validateProfile(p: Profile): string | null {
  if (!(p.age >= 12 && p.age <= 100)) return 'อายุต้องอยู่ระหว่าง 12–100 ปี'
  if (!(p.heightCm >= 100 && p.heightCm <= 250)) return 'ส่วนสูงต้องอยู่ระหว่าง 100–250 cm'
  if (!(p.bodyWeightKg >= 25 && p.bodyWeightKg <= 300)) return 'น้ำหนักตัวต้องอยู่ระหว่าง 25–300 kg'
  if (!p.equipment.length) return 'เลือกอุปกรณ์อย่างน้อย 1 ชนิด'
  return null
}

const EQ_LABEL: Record<Equipment, string> = { barbell: 'บาร์เบล', dumbbell: 'ดัมเบล', machine: 'เครื่อง', cable: 'เคเบิล', bodyweight: 'น้ำหนักตัว' }

export function ProfileForm({ initial, submitLabel, regenerateHint, onSubmit }: {
  initial: Profile; submitLabel: string; regenerateHint?: boolean; onSubmit: (p: Profile, regenerate: boolean) => void
}) {
  const [p, setP] = useState<Profile>(initial)
  const [regen, setRegen] = useState(!regenerateHint)
  const err = validateProfile(p)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP(prev => ({ ...prev, [k]: v }))
  const toggleEq = (e: Equipment) => set('equipment', p.equipment.includes(e) ? p.equipment.filter(x => x !== e) : [...p.equipment, e])
  return (
    <div className="stack">
      <div className="grid3">
        <NumField label="อายุ" value={p.age} onChange={n => set('age', n)} />
        <NumField label="ส่วนสูง (cm)" value={p.heightCm} onChange={n => set('heightCm', n)} />
        <NumField label="น้ำหนัก (kg)" value={p.bodyWeightKg} step={0.1} onChange={n => set('bodyWeightKg', n)} />
      </div>
      <div><div className="sub">เพศ</div>
        <Chips<Sex> value={p.sex} onChange={v => set('sex', v)} options={[{ v: 'male', l: 'ชาย' }, { v: 'female', l: 'หญิง' }, { v: 'other', l: 'อื่นๆ' }]} /></div>
      <div><div className="sub">เป้าหมาย</div>
        <Chips<Goal> value={p.goal} onChange={v => set('goal', v)} options={[
          { v: 'hypertrophy', l: 'สร้างกล้าม' }, { v: 'strength', l: 'Strength' }, { v: 'fat_loss', l: 'ลดไขมัน' }, { v: 'recomp', l: 'Recomp' }, { v: 'general', l: 'ฟิตทั่วไป' }]} /></div>
      <div><div className="sub">ระดับ</div>
        <Chips<Level> value={p.level} onChange={v => set('level', v)} options={[{ v: 'beginner', l: 'Beginner' }, { v: 'intermediate', l: 'Intermediate' }, { v: 'advanced', l: 'Advanced' }]} /></div>
      <div><div className="sub">วันฝึกต่อสัปดาห์</div>
        <Chips<number> value={p.daysPerWeek} onChange={v => set('daysPerWeek', v as Profile['daysPerWeek'])} options={[3, 4, 5, 6].map(v => ({ v, l: `${v} วัน` }))} /></div>
      <div><div className="sub">เวลาต่อ Session</div>
        <Chips<number> value={p.sessionMinutes} onChange={v => set('sessionMinutes', v as Profile['sessionMinutes'])} options={[45, 60, 75, 90, 120].map(v => ({ v, l: `${v} นาที` }))} /></div>
      <div><div className="sub">อุปกรณ์ที่มี</div>
        <div className="chips">{EQUIPMENT.map(e => <button key={e} className={`chip ${p.equipment.includes(e) ? 'on' : ''}`} aria-pressed={p.equipment.includes(e)} onClick={() => toggleEq(e)}>{EQ_LABEL[e]}</button>)}</div></div>
      {regenerateHint && (
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" style={{ width: 22, minHeight: 22 }} checked={regen} onChange={e => setRegen(e.target.checked)} />
          <span className="sub">สร้างโปรแกรมใหม่ตามค่าที่แก้ (โปรแกรมเดิมจะถูกแทนที่ ประวัติการฝึกไม่หาย)</span>
        </label>
      )}
      {err && <div className="card bad" role="alert">{err}</div>}
      <button className="btn primary big" disabled={!!err} onClick={() => onSubmit(p, regen)}>{submitLabel}</button>
    </div>
  )
}
