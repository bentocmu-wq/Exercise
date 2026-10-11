import { useMemo, useState } from 'react'
import { allExercises, exerciseMap, useStore } from '../store/store'
import type { Equipment, Exercise, ExerciseType, Goal, MuscleGroup, PlannedExercise, Program as P, ProgramDay } from '../types'
import { EQUIPMENT, MUSCLES, MUSCLE_LABEL } from '../types'
import { estimateMinutes, generateProgram } from '../engine/generator'
import { currentMeso } from '../engine/periodization'
import { DEFAULT_INCREMENT } from '../data/exercises'
import { addDays, isoDate, uid } from '../engine/util'
import { Chips, Sheet } from './kit'

const Step = ({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number }) => (
  <div style={{ textAlign: 'center' }}>
    <div className="sub" style={{ fontSize: 12 }}>{label}</div>
    <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
      <button className="btn sm" aria-label={`${label} ลด`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−</button>
      <span className="num" style={{ minWidth: 34, fontSize: 20 }}>{value}</span>
      <button className="btn sm" aria-label={`${label} เพิ่ม`} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>+</button>
    </div>
  </div>
)

export function Program() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const [dayId, setDayId] = useState<string | null>(null)
  const [gen, setGen] = useState(false)
  const program = st.program
  const day = program?.days.find(d => d.id === dayId)

  const updateDay = (fn: (d: ProgramDay) => ProgramDay) => program && st.setProgram({ ...program, days: program.days.map(d => (d.id === dayId ? fn(d) : d)) })

  if (program && day) return <DayEditor day={day} map={map} onBack={() => setDayId(null)} update={updateDay} />

  const meso = program ? currentMeso(program) : undefined
  return (
    <div>
      <h1 className="h1">โปรแกรม</h1>
      {program ? (
        <>
          <div className="card hero">
            <div className="h2" style={{ margin: 0 }}>{program.name}</div>
            <div className="sub">{meso?.label} · Mesocycle {program.mesocycleWeeks} สัปดาห์ เริ่ม {program.mesocycleStart}</div>
            <div className="sub mt">หมุนเวียน: {program.days.map(d => d.name).join(' → ')} → (วนซ้ำ)</div>
          </div>
          <div className="stack mt">
            {program.days.map(d => (
              <button key={d.id} className="card" style={{ all: 'unset', display: 'block', background: 'var(--surface)', borderRadius: 16, padding: 16, cursor: 'pointer', width: 'calc(100% - 32px)' }} onClick={() => setDayId(d.id)}>
                <div className="row between"><b style={{ fontSize: 18 }}>{d.name}</b><span className="sub">{d.exercises.length} ท่า · {d.exercises.reduce((n, e) => n + e.sets, 0)} เซ็ต · ~{estimateMinutes(d.exercises)} นาที</span></div>
                <div className="sub">{d.exercises.map(e => map.get(e.exerciseId)?.name).join(' · ')}</div>
              </button>
            ))}
          </div>
          <div className="grid2 mt2">
            <button className="btn" onClick={() => { const name = `Day ${program.days.length + 1}`; st.setProgram({ ...program, days: [...program.days, { id: uid(), name, exercises: [] }] }) }}>+ เพิ่มวัน</button>
            <button className="btn" onClick={() => setGen(true)}>สร้างโปรแกรมใหม่</button>
          </div>
          <div className="mt"><div className="sub">Mesocycle (สัปดาห์)</div>
            <Chips<number> value={program.mesocycleWeeks} options={[4, 5, 6, 7, 8].map(v => ({ v, l: `${v}` }))} onChange={v => st.setProgram({ ...program, mesocycleWeeks: v })} />
            <button className="link" onClick={() => st.setProgram({ ...program, mesocycleStart: isoDate(addDays(new Date(), 0)) })}>เริ่ม Mesocycle ใหม่วันนี้ (Week 1)</button>
            <p className="sub">RIR เป้าหมายจะไต่จาก 3 → 1–2 ตามสัปดาห์ และสัปดาห์สุดท้ายเป็น Deload (ลด ~35% sets) — ถ้า Performance/Readiness บ่งชี้ว่าล้า ระบบจะแนะนำ Deload ก่อนกำหนดในหน้าแรก</p></div>
        </>
      ) : <div className="card"><p>ยังไม่มีโปรแกรม</p><button className="btn primary" onClick={() => setGen(true)}>สร้างโปรแกรม</button></div>}
      {gen && <Generate onClose={() => setGen(false)} />}
    </div>
  )
}

function Generate({ onClose }: { onClose: () => void }) {
  const st = useStore()
  const p = st.profile
  const [goal, setGoal] = useState<Goal>(p?.goal ?? 'hypertrophy')
  const [days, setDays] = useState<number>(p?.daysPerWeek ?? 4)
  const [mins, setMins] = useState<number>(p?.sessionMinutes ?? 75)
  const [custom, setCustom] = useState('')
  const make = () => {
    st.setProgram(generateProgram({ goal, days: days as 3 | 4 | 5 | 6, level: p?.level ?? 'intermediate', sessionMinutes: mins, equipment: p?.equipment }, allExercises(st)))
    onClose()
  }
  const makeCustom = () => {
    const names = custom.split(',').map(s => s.trim()).filter(Boolean).slice(0, 7)
    if (!names.length) return
    const prog: P = { id: uid(), name: `Custom · ${names.length} วัน`, split: 'Custom', days: names.map(name => ({ id: uid(), name, exercises: [] })), createdAt: new Date().toISOString(), mesocycleStart: isoDate(), mesocycleWeeks: 6 }
    st.setProgram(prog); onClose()
  }
  return (
    <Sheet onClose={onClose}>
      <h2 className="h2" style={{ marginTop: 0 }}>สร้างโปรแกรมอัตโนมัติ</h2>
      <div className="stack">
        <Chips<Goal> value={goal} onChange={setGoal} options={[{ v: 'hypertrophy', l: 'สร้างกล้าม' }, { v: 'strength', l: 'Strength' }, { v: 'fat_loss', l: 'ลดไขมัน' }, { v: 'recomp', l: 'Recomp' }, { v: 'general', l: 'ฟิตทั่วไป' }]} />
        <Chips<number> value={days} onChange={setDays} options={[3, 4, 5, 6].map(v => ({ v, l: `${v} วัน` }))} />
        <Chips<number> value={mins} onChange={setMins} options={[45, 60, 75, 90, 120].map(v => ({ v, l: `${v} นาที` }))} />
        <p className="sub">ระดับ ({p?.level ?? 'intermediate'}) และอุปกรณ์มาจากโปรไฟล์ — โปรแกรมเดิมจะถูกแทนที่ ประวัติไม่หาย</p>
        <button className="btn primary big" onClick={make}>สร้างโปรแกรม</button>
        <hr className="hr" />
        <label className="field"><span>หรือ Custom Split — ใส่ชื่อวัน คั่นด้วย , (เช่น Chest+Tri, Back+Bi, Legs)</span><input value={custom} onChange={e => setCustom(e.target.value)} /></label>
        <button className="btn" disabled={!custom.trim()} onClick={makeCustom}>สร้าง Custom Split (เพิ่มท่าเอง)</button>
      </div>
    </Sheet>
  )
}

function DayEditor({ day, map, onBack, update }: { day: ProgramDay; map: Map<string, Exercise>; onBack: () => void; update: (fn: (d: ProgramDay) => ProgramDay) => void }) {
  const st = useStore()
  const [picker, setPicker] = useState(false)
  const [delDay, setDelDay] = useState(false)
  const setEx = (i: number, patch: Partial<PlannedExercise>) => update(d => ({ ...d, exercises: d.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }))
  const move = (i: number, dir: -1 | 1) => update(d => { const a = [...d.exercises]; const j = i + dir; if (j < 0 || j >= a.length) return d;[a[i], a[j]] = [a[j], a[i]]; return { ...d, exercises: a } })
  return (
    <div>
      <button className="link" onClick={onBack}>‹ กลับ</button>
      <label className="field"><span>ชื่อวัน</span><input value={day.name} onChange={e => update(d => ({ ...d, name: e.target.value }))} /></label>
      <div className="sub mt">~{estimateMinutes(day.exercises)} นาที · {day.exercises.reduce((n, e) => n + e.sets, 0)} เซ็ต</div>
      <div className="stack mt">
        {day.exercises.map((e, i) => {
          const def = map.get(e.exerciseId)
          return (
            <div className="card" key={e.exerciseId + i}>
              <div className="row between">
                <div><b>{def?.name ?? e.exerciseId}</b><div className="sub">{def ? MUSCLE_LABEL[def.primary] : ''} · {def?.type} · {def?.equipment}</div></div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn sm" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="btn sm" aria-label="เลื่อนลง" disabled={i === day.exercises.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="btn sm danger" aria-label="ลบท่า" onClick={() => update(d => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}>×</button>
                </div>
              </div>
              <div className="grid3 mt">
                <Step label="Sets" value={e.sets} min={1} max={10} onChange={v => setEx(i, { sets: v })} />
                <Step label="Reps min" value={e.repMin} min={1} max={e.repMax} onChange={v => setEx(i, { repMin: v })} />
                <Step label="Reps max" value={e.repMax} min={e.repMin} max={50} onChange={v => setEx(i, { repMax: v })} />
                <Step label="RIR min" value={e.rirMin} min={0} max={e.rirMax} onChange={v => setEx(i, { rirMin: v })} />
                <Step label="RIR max" value={e.rirMax} min={e.rirMin} max={5} onChange={v => setEx(i, { rirMax: v })} />
                <Step label="พัก (วินาที)" value={e.restSec} min={15} max={600} step={15} onChange={v => setEx(i, { restSec: v })} />
              </div>
              <div className="grid2 mt">
                <label className="field"><span>Tempo</span><input value={e.tempo ?? ''} placeholder="2-0-1-0" onChange={ev => setEx(i, { tempo: ev.target.value })} /></label>
                <label className="field"><span>Increment (kg)</span><input type="number" inputMode="decimal" step="0.25" min="0.25" value={e.increment ?? def?.increment ?? 2.5}
                  onChange={ev => { const n = parseFloat(ev.target.value); if (n > 0) setEx(i, { increment: n }) }} /></label>
              </div>
            </div>
          )
        })}
      </div>
      {!day.exercises.length && <div className="card sub mt">ยังไม่มีท่า — กด “เพิ่มท่า”</div>}
      <div className="grid2 mt2">
        <button className="btn primary" onClick={() => setPicker(true)}>+ เพิ่มท่า</button>
        <button className="btn danger" onClick={() => setDelDay(true)}>ลบวันนี้</button>
      </div>
      {picker && <Picker map={map} onClose={() => setPicker(false)} onPick={ex => {
        const compound = ex.type === 'compound'
        update(d => ({ ...d, exercises: [...d.exercises, { exerciseId: ex.id, sets: 3, repMin: compound ? 8 : 10, repMax: compound ? 12 : 15, rirMin: compound ? 1 : 0, rirMax: compound ? 3 : 2, restSec: compound ? 150 : 90 }] }))
        setPicker(false)
      }} />}
      {delDay && (
        <Sheet onClose={() => setDelDay(false)}>
          <h2 className="h2" style={{ marginTop: 0 }}>ลบ “{day.name}”?</h2>
          <div className="grid2"><button className="btn" onClick={() => setDelDay(false)}>ยกเลิก</button>
            <button className="btn danger" onClick={() => { const p = st.program!; st.setProgram({ ...p, days: p.days.filter(d => d.id !== day.id) }); onBack() }}>ลบ</button></div>
        </Sheet>
      )}
    </div>
  )
}

function Picker({ map, onPick, onClose }: { map: Map<string, Exercise>; onPick: (e: Exercise) => void; onClose: () => void }) {
  const st = useStore()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState<{ name: string; primary: MuscleGroup; type: ExerciseType; equipment: Equipment }>({ name: '', primary: 'chest', type: 'compound', equipment: 'barbell' })
  const list = [...map.values()].filter(e => (muscle === 'all' || e.primary === muscle) && e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet onClose={onClose}>
      <h2 className="h2" style={{ marginTop: 0 }}>เลือกท่า</h2>
      <input placeholder="ค้นหา" value={q} onChange={e => setQ(e.target.value)} aria-label="ค้นหาท่า" />
      <div className="mt"><Chips<string> value={muscle} onChange={v => setMuscle(v as MuscleGroup | 'all')} options={[{ v: 'all', l: 'ทั้งหมด' }, ...MUSCLES.map(m => ({ v: m as string, l: MUSCLE_LABEL[m] }))]} /></div>
      <div className="mt">{list.map(e => <button key={e.id} className="btn" style={{ width: '100%', textAlign: 'left', marginBottom: 6 }} onClick={() => onPick(e)}>{e.name}<span className="sub"> · {MUSCLE_LABEL[e.primary]} · {e.equipment}</span></button>)}
        {!list.length && <div className="sub">ไม่พบท่า — เพิ่มท่าเองได้ด้านล่าง</div>}</div>
      <hr className="hr" />
      {!adding ? <button className="btn ghost" onClick={() => setAdding(true)}>+ สร้างท่าใหม่เอง</button> : (
        <div className="stack">
          <label className="field"><span>ชื่อท่า</span><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <div className="sub">กล้ามเนื้อหลัก</div><Chips<string> value={f.primary} onChange={v => setF({ ...f, primary: v as MuscleGroup })} options={MUSCLES.map(m => ({ v: m as string, l: MUSCLE_LABEL[m] }))} />
          <div className="sub">ประเภท</div><Chips<ExerciseType> value={f.type} onChange={v => setF({ ...f, type: v })} options={[{ v: 'compound', l: 'Compound' }, { v: 'isolation', l: 'Isolation' }]} />
          <div className="sub">อุปกรณ์</div><Chips<string> value={f.equipment} onChange={v => setF({ ...f, equipment: v as Equipment })} options={EQUIPMENT.map(e => ({ v: e as string, l: e }))} />
          <button className="btn primary" disabled={!f.name.trim()} onClick={() => { const ex = st.addCustomExercise({ name: f.name.trim(), primary: f.primary, secondary: [], type: f.type, equipment: f.equipment, increment: DEFAULT_INCREMENT[f.equipment] }); onPick(ex) }}>บันทึกและเพิ่มเข้าวัน</button>
        </div>
      )}
    </Sheet>
  )
}
