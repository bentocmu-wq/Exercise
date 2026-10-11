import { useEffect, useMemo, useRef, useState } from 'react'
import { activeSession, exerciseMap, useStore } from '../store/store'
import type { PRKind, Session, SessionExercise } from '../types'
import { PR_LABEL } from '../engine/pr'
import { calculateE1RM } from '../engine/e1rm'
import { calculateVolume } from '../engine/volume'
import { fmtKg } from '../engine/util'
import { exerciseHistory, finished, sessionAvgRir, sessionMinutes, sessionVolume } from '../engine/analytics'
import { Counter, Sheet, useNow } from './kit'

const mmss = (sec: number) => `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`
const actionBadge = { INCREASE: ['up', 'เพิ่มน้ำหนัก'], HOLD: ['hold', 'คงน้ำหนัก'], DECREASE: ['down', 'ลดน้ำหนัก'], START: ['', 'เริ่มใหม่'] } as const

export function Workout({ onExit }: { onExit: () => void }) {
  const st = useStore()
  const session = activeSession(st)
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const [idx, setIdx] = useState(() => Math.max(0, session?.exercises.findIndex(e => !e.completed) ?? 0))
  const [rest, setRest] = useState<{ end: number; total: number; buzzed: boolean } | null>(null)
  const [prs, setPrs] = useState<PRKind[]>([])
  const [coach, setCoach] = useState<string | null>(null)
  const [summary, setSummary] = useState<Session | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [pain, setPain] = useState(false)
  const now = useNow(250)

  useEffect(() => { if (!prs.length) return; const t = setTimeout(() => setPrs([]), 2600); return () => clearTimeout(t) }, [prs])
  useEffect(() => {
    if (rest && now >= rest.end && !rest.buzzed) { navigator.vibrate?.([200, 100, 200]); setRest({ ...rest, buzzed: true }) }
  }, [now, rest])

  const ex = session?.exercises[idx]
  const def = ex ? map.get(ex.exerciseId) : undefined
  const inc = ex ? ex.planned.increment ?? def?.increment ?? 2.5 : 2.5

  // entry state
  const lastSet = ex?.sets[ex.sets.length - 1]
  const startWeight = lastSet?.weight ?? ex?.recommendation.recommendedWeight ?? 0
  const [weight, setWeight] = useState<number>(startWeight)
  const [reps, setReps] = useState<number>(lastSet?.reps ?? ex?.planned.repMin ?? 8)
  const [rir, setRir] = useState<number | undefined>(lastSet?.rir ?? ex?.planned.rirMax)
  const key = useRef('')
  useEffect(() => {
    const k = `${session?.id}:${idx}`
    if (key.current === k) return
    key.current = k
    setWeight(ex?.sets.length ? ex.sets[ex.sets.length - 1].weight : ex?.recommendation.recommendedWeight ?? 0)
    setReps(ex?.sets.length ? ex.sets[ex.sets.length - 1].reps : ex?.planned.repMin ?? 8)
    setRir(ex?.sets.length ? ex.sets[ex.sets.length - 1].rir : ex?.planned.rirMax)
    setPain(!!ex?.painFlag)
  }, [idx, session?.id, ex])

  const history = useMemo(() => (ex ? exerciseHistory(st.sessions, ex.exerciseId).slice(-1)[0] : undefined), [st.sessions, ex?.exerciseId])

  if (summary) return <Summary s={summary} onDone={onExit} names={map} />
  if (!session || !ex) return <div className="card">ไม่มี Workout ที่กำลังทำอยู่ <button className="btn mt" onClick={onExit}>กลับ</button></div>

  const canSave = reps > 0 && weight >= 0
  const save = () => {
    if (!canSave) return
    const kinds = st.logSet(idx, { weight, reps, rir })
    if (kinds.length) setPrs(kinds)
    setRest({ end: Date.now() + ex.planned.restSec * 1000, total: ex.planned.restSec, buzzed: false })
  }
  const rec = ex.recommendation
  const [bcls, blabel] = actionBadge[rec.action]
  const elapsed = (now - new Date(session.startedAt).getTime()) / 1000
  const doneCount = session.exercises.filter(e => e.completed).length

  return (
    <div>
      <div className="row between">
        <div><div className="sub">{session.name}{session.mesoLabel ? ` · ${session.mesoLabel}` : ''}{session.deload ? ' · Deload' : ''}</div>
          <div className="num" style={{ fontSize: 28 }}>{mmss(elapsed)}</div></div>
        <button className="btn sm" onClick={() => setConfirmEnd(true)}>จบ Workout</button>
      </div>

      <div className="chips mt" role="tablist" aria-label="ท่าที่จะเล่น">
        {session.exercises.map((e, i) => (
          <button key={e.exerciseId + i} role="tab" aria-selected={i === idx} className={`chip ${i === idx ? 'on' : ''}`} onClick={() => setIdx(i)}>
            {e.completed ? '✓ ' : ''}{(map.get(e.exerciseId)?.name ?? '?').split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>
      <div className="bar mt" aria-label={`เสร็จ ${doneCount} จาก ${session.exercises.length} ท่า`}><i style={{ width: `${(doneCount / session.exercises.length) * 100}%` }} /></div>

      <div className="card hero mt">
        <div className="h2" style={{ margin: 0 }}>{def?.name}</div>
        <div className="sub">เป้าหมาย {ex.planned.sets} × {ex.planned.repMin}–{ex.planned.repMax} reps · RIR {ex.planned.rirMin}–{ex.planned.rirMax} · พัก {Math.round(ex.planned.restSec / 60 * 10) / 10} นาที{ex.planned.tempo ? ` · Tempo ${ex.planned.tempo}` : ''}</div>

        <div className="hr" />
        <div className="sub">ครั้งก่อน{history ? ` (${new Date(history.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})` : ''}</div>
        {history ? <div className="num" style={{ fontSize: 19 }}>{history.sets.map(s => `${fmtKg(s.weight)}×${s.reps}`).join('  ·  ')}</div> : <div className="sub">ยังไม่เคยทำท่านี้</div>}

        <div className="card flat mt">
          <div className="row between"><div className="sub">คำแนะนำวันนี้</div><span className={`badge ${bcls}`}>{blabel}</span></div>
          <div className="num" style={{ fontSize: 34 }}>{rec.recommendedWeight !== null ? `${fmtKg(rec.recommendedWeight)} kg` : 'เลือกน้ำหนักเอง'}</div>
          <div style={{ fontSize: 14 }}>{rec.reason}</div>
          {rec.nextRepTarget && <div className="sub mt">เป้า: {rec.nextRepTarget}</div>}
          {rec.evidence.length > 0 && <details><summary>ดูข้อมูลที่ใช้ตัดสิน (ความมั่นใจ: {rec.confidence})</summary>
            <div className="sub">{rec.evidence.map((l, i) => <div key={i}>Session ก่อน · {l}</div>)}{session.readiness && <div>Readiness วันนี้ · {session.readiness.score}%</div>}</div></details>}
        </div>
        {rec.warning && <div className="card warn mt" role="alert" style={{ fontSize: 14 }}>⚠ {rec.warning}</div>}
      </div>

      {ex.sets.length > 0 && (
        <div className="card mt">
          {ex.sets.map(s => (
            <div className="setline" key={s.id}>
              <span className="sub num">{s.setNumber}</span>
              <span className="num" style={{ fontSize: 20 }}>{fmtKg(s.weight)} kg × {s.reps}</span>
              <span className="sub">{s.rir !== undefined ? `RIR ${s.rir}` : '—'} · e1RM {calculateE1RM(s.weight, s.reps) || '—'}</span>
              <button className="xbtn" aria-label={`ลบเซ็ต ${s.setNumber}`} onClick={() => st.removeSet(idx, s.id)}>×</button>
            </div>
          ))}
          <div className="sub mt">Volume {calculateVolume(ex.sets).toLocaleString()} kg · {ex.sets.length}/{ex.planned.sets} เซ็ต</div>
        </div>
      )}

      <div className="plate mt">
        <div className="sub" style={{ marginBottom: 6 }}>เซ็ต {ex.sets.length + 1}{ex.sets.length >= ex.planned.sets ? ' (เซ็ตเพิ่ม)' : ''}</div>
        <Counter label="น้ำหนัก (kg)" value={weight} onChange={setWeight} step={inc} max={700} />
        <div style={{ height: 6 }} />
        <Counter label="Reps" value={reps} onChange={setReps} step={1} decimals={0} max={100} />
        <div className="sub mt" style={{ marginBottom: 6 }}>RIR (เหลืออีกกี่ reps)</div>
        <div className="rir" role="group" aria-label="RIR">
          {[0, 1, 2, 3, 4].map(n => <button key={n} className={rir === n ? 'on' : ''} aria-pressed={rir === n} onClick={() => setRir(n)}>{n === 4 ? '4+' : n}</button>)}
          <button className={rir === undefined ? 'on' : ''} aria-pressed={rir === undefined} onClick={() => setRir(undefined)} aria-label="ไม่ระบุ RIR">?</button>
        </div>
        <button className="btn primary big mt" disabled={!canSave} onClick={save}>บันทึกเซ็ต</button>
        {!canSave && <div className="sub mt">ใส่จำนวน reps อย่างน้อย 1 ครั้ง</div>}
      </div>

      <div className="card mt">
        <div className="row between">
          <button className={`btn sm ${pain ? 'danger' : ''}`} onClick={() => { const n = !pain; setPain(n); st.setPain(idx, n, n ? ex.painNote : undefined) }}>{pain ? '⚠ บันทึกอาการปวดแล้ว' : 'มีอาการปวด?'}</button>
          <button className="btn primary" disabled={!ex.sets.length} onClick={() => { setCoach(st.completeExercise(idx)); setRest(null) }}>จบท่านี้</button>
        </div>
        {pain && <>
          <label className="field mt"><span>ปวดตรงไหน / ลักษณะอย่างไร</span>
            <input value={ex.painNote ?? ''} placeholder="เช่น ไหล่ขวาเจ็บตอนยกขึ้น" onChange={e => st.setPain(idx, true, e.target.value)} /></label>
          <p className="sub">ระบบจะไม่แนะนำให้เพิ่มน้ำหนักในท่านี้จนกว่าจะประเมินใหม่ หากปวดต่อเนื่องควรหยุดหรือปรับท่า และพิจารณาปรึกษาผู้เชี่ยวชาญ</p></>}
        <label className="field mt"><span>โน้ต (เทคนิค / อุปกรณ์ / ฟอร์ม) — แยกจากข้อมูล Performance</span>
          <textarea value={ex.notes ?? ''} onChange={e => st.setNotes(idx, e.target.value)} /></label>
      </div>

      {rest && <RestBar rest={rest} now={now} onAdjust={d => setRest(r => r && { ...r, end: r.end + d * 1000, buzzed: false })} onSkip={() => setRest(null)} />}

      {prs.length > 0 && <div className="pr-overlay" role="status"><div className="pr-card"><b>🔥 NEW PR</b>{prs.map(k => PR_LABEL[k]).join(' · ')}</div></div>}

      {coach !== null && (
        <Sheet onClose={() => setCoach(null)}>
          <h2 className="h2" style={{ marginTop: 0 }}>{def?.name}</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{coach}</p>
          <button className="btn primary big" onClick={() => {
            setCoach(null)
            const next = session.exercises.findIndex((e, i) => i !== idx && !e.completed)
            if (next >= 0) setIdx(next)
          }}>ท่าถัดไป</button>
        </Sheet>
      )}
      {confirmEnd && (
        <Sheet onClose={() => setConfirmEnd(false)}>
          <h2 className="h2" style={{ marginTop: 0 }}>จบ Workout?</h2>
          <p className="sub">ท่าที่ไม่มีเซ็ตจะไม่ถูกบันทึก</p>
          <div className="stack">
            <button className="btn primary big" onClick={() => { const s = st.finishSession(); setConfirmEnd(false); if (s) setSummary(s) }}>จบและบันทึก</button>
            <button className="btn danger" onClick={() => { st.discardSession(); setConfirmEnd(false); onExit() }}>ทิ้ง Workout นี้</button>
            <button className="btn" onClick={() => setConfirmEnd(false)}>ทำต่อ</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function RestBar({ rest, now, onAdjust, onSkip }: { rest: { end: number; total: number }; now: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const left = Math.ceil((rest.end - now) / 1000)
  return (
    <div className={`rest ${left <= 0 ? 'done' : ''}`} role="timer" aria-live="off">
      <span className="t">{left > 0 ? mmss(left) : 'พร้อม!'}</span>
      <span className="grow" />
      <button onClick={() => onAdjust(-30)}>−30</button>
      <button onClick={() => onAdjust(30)}>+30</button>
      <button onClick={onSkip}>{left > 0 ? 'ข้าม' : 'ปิด'}</button>
    </div>
  )
}

function Summary({ s, onDone, names }: { s: Session; onDone: () => void; names: ReturnType<typeof exerciseMap> }) {
  const records = useStore(x => x.records.filter(r => r.sessionId === s.id))
  const all = useStore(x => x.sessions)
  const prevVol = finished(all).filter(x => x.id !== s.id && x.programDayId === s.programDayId).slice(-1)[0]
  const vol = sessionVolume(s)
  const e: SessionExercise[] = s.exercises
  return (
    <div>
      <h1 className="h1">จบ Workout 💪</h1>
      <div className="card hero stack">
        <div className="grid2">
          <div><div className="sub">เวลา</div><div className="num" style={{ fontSize: 32 }}>{sessionMinutes(s) ?? '—'} นาที</div></div>
          <div><div className="sub">Volume</div><div className="num" style={{ fontSize: 32 }}>{vol.toLocaleString()} kg</div></div>
          <div><div className="sub">เซ็ตทั้งหมด</div><div className="num" style={{ fontSize: 32 }}>{e.reduce((n, x) => n + x.sets.length, 0)}</div></div>
          <div><div className="sub">RIR เฉลี่ย</div><div className="num" style={{ fontSize: 32 }}>{sessionAvgRir(s) ?? '—'}</div></div>
        </div>
        {prevVol && <div className="sub">เทียบ {prevVol.name} ครั้งก่อน: {vol >= sessionVolume(prevVol) ? '+' : ''}{(vol - sessionVolume(prevVol)).toLocaleString()} kg</div>}
      </div>
      {records.length > 0 && <>
        <h2 className="h2">PR ใหม่ 🔥</h2>
        <div className="card stack">{records.map(r => <div key={r.id} className="row between"><span>{names.get(r.exerciseId)?.name}</span><span className="badge pr">{PR_LABEL[r.kind]} · {r.kind === 'volume' ? `${r.value.toLocaleString()} kg` : r.kind === 'reps' ? `${r.weight}×${r.reps}` : r.kind === 'e1rm' ? `${r.value} kg` : `${r.value} kg`}</span></div>)}</div></>}
      <button className="btn primary big mt2" onClick={onDone}>กลับหน้าแรก</button>
    </div>
  )
}
