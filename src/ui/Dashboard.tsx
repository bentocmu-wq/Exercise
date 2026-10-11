import { useMemo, useState } from 'react'
import { activeSession, exerciseMap, isDeloadActive, nextDayIndex, useStore } from '../store/store'
import { calculateReadiness, READINESS_TEXT } from '../engine/readiness'
import { currentMeso } from '../engine/periodization'
import { estimateMinutes } from '../engine/generator'
import { detectDeload } from '../engine/deload'
import { bodyWeightStats } from '../engine/bodyweight'
import { computeDeloadSignals, finished, sessionsInWeek, trainingStreakWeeks, weeklyVolume } from '../engine/analytics'
import { PR_LABEL } from '../engine/pr'
import { fmtKg } from '../engine/util'
import type { ReadinessInput } from '../types'
import { Sheet, fmtDate } from './kit'

const Q: { k: keyof ReadinessInput; l: string; lo: string; hi: string }[] = [
  { k: 'sleep', l: 'การนอน', lo: 'แย่', hi: 'ดีมาก' },
  { k: 'energy', l: 'พลังงาน', lo: 'หมดแรง', hi: 'เต็มที่' },
  { k: 'soreness', l: 'ความเมื่อยล้า/ปวดเมื่อย', lo: 'ไม่เมื่อย', hi: 'เมื่อยมาก' },
  { k: 'stress', l: 'ความเครียด', lo: 'สบาย', hi: 'เครียดมาก' }
]

export function Dashboard({ onStart, onGoProgram }: { onStart: () => void; onGoProgram: () => void }) {
  const st = useStore()
  const [ready, setReady] = useState<ReadinessInput | null>(null)
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const active = activeSession(st)
  const program = st.program
  const day = program?.days[nextDayIndex(st)]
  const meso = program ? currentMeso(program) : undefined
  const deloadOn = isDeloadActive(st) || !!meso?.deload
  const bw = bodyWeightStats(st.bodyWeights)
  const wv = weeklyVolume(st.sessions, 4)
  const thisWeekVol = wv[wv.length - 1]?.volume ?? 0
  const streak = trainingStreakWeeks(st.sessions, st.profile)
  const done = finished(st.sessions)
  const lastReady = done.slice().reverse().find(s => s.readiness)?.readiness
  const lastPR = st.records.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  const signals = useMemo(() => computeDeloadSignals(st.sessions, map, st.profile, program), [st.sessions, st.profile, program, map])
  const deload = detectDeload(signals)
  const sets = day?.exercises.reduce((n, e) => n + e.sets, 0) ?? 0
  const live = ready ? calculateReadiness(ready) : null

  const start = (r?: ReadinessInput) => { st.startSession(day!.id, r); setReady(null); onStart() }

  return (
    <div>
      <h1 className="h1">วันนี้</h1>

      {active ? (
        <div className="card hero">
          <div className="sub">Workout ที่ยังไม่จบ</div>
          <div className="h2" style={{ margin: '2px 0 10px' }}>{active.name}</div>
          <button className="btn primary big" onClick={onStart}>ทำต่อ</button>
        </div>
      ) : day ? (
        <div className="card hero">
          <div className="row between"><div className="sub">{meso?.label}{deloadOn ? ' · Deload' : ''}</div>{isDeloadActive(st) && <span className="badge hold">Deload week</span>}</div>
          <div className="h1" style={{ margin: '4px 0' }}>{day.name}</div>
          <div className="sub">{day.exercises.length} ท่า · {sets} เซ็ต · ประมาณ {estimateMinutes(day.exercises)} นาที</div>
          <div className="sub mt">{day.exercises.slice(0, 4).map(e => map.get(e.exerciseId)?.name).join(' · ')}{day.exercises.length > 4 ? ' …' : ''}</div>
          <button className="btn primary big mt" disabled={!day.exercises.length} onClick={() => setReady({ sleep: 3, energy: 3, soreness: 3, stress: 3 })}>เริ่ม Workout</button>
          {!day.exercises.length && <div className="sub mt">วันนี้ยังไม่มีท่า — เพิ่มท่าในแท็บโปรแกรม</div>}
        </div>
      ) : (
        <div className="card hero"><p>ยังไม่มีโปรแกรม</p><button className="btn primary" onClick={onGoProgram}>ไปสร้างโปรแกรม</button></div>
      )}

      {deload.shouldDeload && !deloadOn && (
        <div className="card warn mt" role="alert">
          <b>ควรพิจารณา Deload</b>
          <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{deload.signals.map(s => <li key={s}>{s}</li>)}</ul>
          <div className="sub">แนะนำ: ลด Volume {deload.volumeReductionPct?.join('–')}%{deload.loadReductionPct ? ` และลดน้ำหนัก ${deload.loadReductionPct.join('–')}%` : ''} ประมาณ 1 สัปดาห์</div>
          <button className="btn sm mt" onClick={st.startDeloadWeek}>เริ่ม Deload 7 วัน</button>
        </div>
      )}
      {isDeloadActive(st) && <div className="card flat mt row between"><span className="sub">Deload ถึง {fmtDate(st.deloadUntil!)}</span><button className="link" onClick={st.cancelDeload}>ยกเลิก</button></div>}

      <div className="grid2 mt">
        <div className="card"><div className="sub">น้ำหนักตัว</div>
          <div className="num" style={{ fontSize: 32 }}>{bw.latest ? `${bw.latest.kg} kg` : '—'}</div>
          <div className="sub">{bw.avg7 ? `เฉลี่ย 7 วัน ${bw.avg7.avg} (${bw.avg7.count} ครั้ง)` : 'ยังไม่มีข้อมูล'}</div></div>
        <div className="card"><div className="sub">Volume สัปดาห์นี้</div>
          <div className="num" style={{ fontSize: 32 }}>{thisWeekVol.toLocaleString()}</div>
          <div className="sub">kg · {sessionsInWeek(st.sessions)}/{st.profile?.daysPerWeek ?? '—'} sessions</div></div>
        <div className="card"><div className="sub">Training streak</div>
          <div className="num" style={{ fontSize: 32 }}>{streak} สัปดาห์</div>
          <div className="sub">ฝึกอย่างน้อย {Math.max(1, (st.profile?.daysPerWeek ?? 3) - 1)} วัน/สัปดาห์</div></div>
        <div className="card"><div className="sub">Readiness ล่าสุด</div>
          <div className="num" style={{ fontSize: 32 }}>{lastReady ? `${lastReady.score}%` : '—'}</div>
          <div className="sub">{lastReady ? READINESS_TEXT[lastReady.advice] : 'จะถามก่อนเริ่มฝึก'}</div></div>
      </div>

      <h2 className="h2">PR ล่าสุด</h2>
      <div className="card">
        {lastPR ? <div className="row between"><div><div>{map.get(lastPR.exerciseId)?.name}</div><div className="sub">{fmtDate(lastPR.date)}</div></div>
          <span className="badge pr">🔥 {PR_LABEL[lastPR.kind]} · {lastPR.kind === 'reps' ? `${fmtKg(lastPR.weight)}×${lastPR.reps}` : `${fmtKg(lastPR.value)} ${lastPR.kind === 'volume' || lastPR.kind === 'e1rm' || lastPR.kind === 'weight' ? 'kg' : ''}`}</span></div>
          : <span className="sub">PR จะถูกตรวจจับอัตโนมัติเมื่อคุณทำได้ดีกว่าประวัติเดิม</span>}
      </div>

      <h2 className="h2">สรุปความก้าวหน้า</h2>
      <div className="card"><div className="sub" style={{ marginBottom: 8 }}>Volume รายสัปดาห์ (kg) · 4 สัปดาห์ล่าสุด</div>
        <div className="row" style={{ alignItems: 'flex-end', height: 70, gap: 8 }}>
          {wv.map((w, i) => { const max = Math.max(1, ...wv.map(x => x.volume)); return <div key={w.weekStart} className="grow" style={{ textAlign: 'center' }}>
            <div style={{ height: Math.max(3, (w.volume / max) * 56), background: i === wv.length - 1 ? 'var(--text)' : 'var(--info)', opacity: i === wv.length - 1 ? 1 : .6, borderRadius: 4 }} />
            <div className="sub" style={{ fontSize: 11 }}>{(w.volume / 1000).toFixed(1)}k</div></div> })}
        </div>
      </div>

      {ready && (
        <Sheet onClose={() => setReady(null)}>
          <h2 className="h2" style={{ marginTop: 0 }}>วันนี้พร้อมแค่ไหน?</h2>
          <div className="stack">
            {Q.map(q => (
              <div key={q.k}>
                <div className="row between"><span>{q.l}</span><span className="sub">{q.lo} → {q.hi}</span></div>
                <div className="rir" style={{ gridTemplateColumns: 'repeat(5,1fr)' }} role="group" aria-label={q.l}>
                  {[1, 2, 3, 4, 5].map(n => <button key={n} className={ready[q.k] === n ? 'on' : ''} aria-pressed={ready[q.k] === n} onClick={() => setReady({ ...ready, [q.k]: n })}>{n}</button>)}
                </div>
              </div>
            ))}
          </div>
          {live && <div className="card flat mt"><div className="num" style={{ fontSize: 30 }}>Readiness {live.score}%</div><div>{READINESS_TEXT[live.advice]}</div></div>}
          <button className="btn primary big mt" onClick={() => start(ready)}>เริ่ม Workout</button>
          <button className="link mt" onClick={() => start()}>ข้าม (ไม่ใช้ Readiness)</button>
        </Sheet>
      )}
    </div>
  )
}
