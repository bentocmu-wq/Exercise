import { useMemo, useState } from 'react'
import { exerciseMap, useStore } from '../store/store'
import { MAIN_LIFTS } from '../data/exercises'
import { MUSCLES, MUSCLE_LABEL } from '../types'
import { bandText, exerciseHistory, finished, muscleTrend, setStatus, weeklyHardSets, weeklyMuscleVolume, weeklyVolume, sessionsInWeek, trainingStreakWeeks } from '../engine/analytics'
import { bodyWeightStats, strengthToWeight } from '../engine/bodyweight'
import { PR_LABEL } from '../engine/pr'
import { addDays, fmtKg, isoDate, startOfWeek } from '../engine/util'
import { BarChart, Chips, LineChart, fmtDate } from './kit'

type Tab = 'overview' | 'strength' | 'muscle' | 'exercise' | 'body'

export function Stats() {
  const [tab, setTab] = useState<Tab>('overview')
  return (
    <div>
      <h1 className="h1">สถิติ</h1>
      <Chips<Tab> value={tab} onChange={setTab} options={[{ v: 'overview', l: 'ภาพรวม' }, { v: 'strength', l: 'Strength' }, { v: 'muscle', l: 'กล้ามเนื้อ' }, { v: 'exercise', l: 'รายท่า' }, { v: 'body', l: 'น้ำหนักตัว' }]} />
      <div className="mt">
        {tab === 'overview' && <Overview />}{tab === 'strength' && <Strength />}{tab === 'muscle' && <Muscle />}{tab === 'exercise' && <ExerciseTab />}{tab === 'body' && <Body />}
      </div>
    </div>
  )
}

function Overview() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const wv = weeklyVolume(st.sessions, 8)
  const bw = bodyWeightStats(st.bodyWeights)
  const done = finished(st.sessions)
  const consistency = st.profile ? Math.min(100, Math.round((sessionsInWeek(st.sessions) / st.profile.daysPerWeek) * 100)) : null
  const lifts = MAIN_LIFTS.map(id => ({ id, h: exerciseHistory(st.sessions, id) })).filter(x => x.h.length)
  const bodyKg = bw.avg7?.avg ?? bw.latest?.kg
  return (
    <div className="stack">
      <div className="card"><div className="sub">Volume load รายสัปดาห์ (kg)</div><BarChart bars={wv.map(w => ({ label: fmtDate(w.weekStart).replace(' ', '\u00a0'), value: w.volume }))} /></div>
      <div className="grid2">
        <div className="card"><div className="sub">Sessions ทั้งหมด</div><div className="num" style={{ fontSize: 32 }}>{done.length}</div></div>
        <div className="card"><div className="sub">PR ทั้งหมด</div><div className="num" style={{ fontSize: 32 }}>{st.records.length}</div></div>
        <div className="card"><div className="sub">สัปดาห์นี้</div><div className="num" style={{ fontSize: 32 }}>{consistency === null ? '—' : `${consistency}%`}</div><div className="sub">ของเป้า {st.profile?.daysPerWeek ?? '—'} วัน</div></div>
        <div className="card"><div className="sub">Streak</div><div className="num" style={{ fontSize: 32 }}>{trainingStreakWeeks(st.sessions, st.profile)} สัปดาห์</div></div>
      </div>
      <div className="card">
        <b>Strength-to-weight</b>
        <div className="sub">e1RM ÷ น้ำหนักตัว{bodyKg ? ` (${bodyKg} kg${bw.avg7 ? ', เฉลี่ย 7 วัน' : ''})` : ''}</div>
        {!lifts.length && <div className="sub mt">ยังไม่มีข้อมูล e1RM ของท่าหลัก (Bench / Squat / Deadlift / OHP)</div>}
        {lifts.map(l => { const best = l.h[l.h.length - 1].e1rm; const r = bodyKg ? strengthToWeight(best, bodyKg) : null
          return <div key={l.id} className="row between mt"><span>{map.get(l.id)?.name}</span><span className="num">{fmtKg(best)} kg{r ? ` · ${r}×BW` : ''}</span></div> })}
      </div>
      <div className="card"><b>PR ล่าสุด</b>
        {!st.records.length && <div className="sub">ยังไม่มี PR</div>}
        {st.records.slice(-6).reverse().map(r => <div key={r.id} className="row between mt"><span>{map.get(r.exerciseId)?.name}</span><span className="badge pr">{PR_LABEL[r.kind]}</span></div>)}</div>
    </div>
  )
}

const RANGES = [{ v: 30, l: '1M' }, { v: 90, l: '3M' }, { v: 180, l: '6M' }, { v: 365, l: '1Y' }]
function Strength() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const logged = useMemo(() => [...map.keys()].filter(id => exerciseHistory(st.sessions, id).some(r => r.e1rm > 0)), [st.sessions, map])
  const options = [...MAIN_LIFTS.filter(id => logged.includes(id)), ...logged.filter(id => !MAIN_LIFTS.includes(id))]
  const [sel, setSel] = useState<string>(options[0] ?? '')
  const [range, setRange] = useState(90)
  const id = options.includes(sel) ? sel : options[0]
  if (!id) return <div className="card sub">บันทึก Workout อย่างน้อย 1 ครั้งเพื่อดู e1RM</div>
  const cutoff = Date.now() - range * 86_400_000
  const pts = exerciseHistory(st.sessions, id).filter(r => r.e1rm > 0 && new Date(r.date).getTime() >= cutoff).map(r => ({ t: new Date(r.date).getTime(), v: r.e1rm }))
  const change = pts.length >= 2 ? pts[pts.length - 1].v - pts[0].v : null
  return (
    <div className="stack">
      <div className="chips">{options.map(o => <button key={o} className={`chip ${o === id ? 'on' : ''}`} onClick={() => setSel(o)}>{map.get(o)?.name}</button>)}</div>
      <Chips<number> value={range} onChange={setRange} options={RANGES} />
      <div className="card">
        <div className="row between"><b>Estimated 1RM (Epley)</b>{change !== null && <span className={`badge ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? '+' : ''}{fmtKg(Math.round(change * 10) / 10)} kg</span>}</div>
        <LineChart points={pts} unit=" kg" />
        <div className="sub">e1RM = น้ำหนัก × (1 + reps/30) — ใช้เฉพาะเซ็ตที่ ≤ 12 reps</div>
      </div>
    </div>
  )
}

function Muscle() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const level = st.profile?.level ?? 'intermediate'
  const ws = startOfWeek(new Date())
  const hard = weeklyHardSets(st.sessions, map, ws)
  const vol = weeklyMuscleVolume(st.sessions, map, ws)
  const weeks = [3, 2, 1, 0].map(i => addDays(ws, -7 * i))
  const volHist = weeks.map(w => weeklyMuscleVolume(st.sessions, map, w))
  const label = { low: ['', 'ต่ำ'], optimal: ['up', 'เหมาะสม'], high: ['down', 'สูง'] } as const
  return (
    <div className="stack">
      <div className="card"><b>Hard sets สัปดาห์นี้</b>
        <div className="sub">เซ็ตที่ RIR ≤ 3 (ท่ารองนับ 0.5) · ช่วงอ้างอิงระดับ {level}: {bandText(level)}/กล้ามเนื้อ — ปรับตาม Performance จริง (ถ้า e1RM ตก เกณฑ์ “สูง” จะต่ำลง)</div>
        {MUSCLES.map(m => { const n = hard[m]; const trend = muscleTrend(st.sessions, map, m); const s = setStatus(n, level, trend); const [cls, txt] = label[s]
          return <div key={m} className="row between mt"><span>{MUSCLE_LABEL[m]}</span><span className="row" style={{ gap: 8 }}><span className="num" style={{ fontSize: 20 }}>{n}</span><span className={`badge ${cls}`}>{txt}</span>{trend !== 'flat' && <span className="sub">{trend === 'up' ? '↑' : '↓'}</span>}</span></div> })}</div>
      <div className="card"><b>Volume load ต่อกล้ามเนื้อ (kg)</b>
        <table><thead><tr><th></th>{weeks.map(w => <th key={isoDate(w)}>{fmtDate(isoDate(w))}</th>)}</tr></thead>
          <tbody>{MUSCLES.map(m => <tr key={m}><td>{MUSCLE_LABEL[m]}</td>{volHist.map((v, i) => <td key={i} className="num">{Math.round(v[m]).toLocaleString()}</td>)}</tr>)}</tbody></table>
        <div className="sub mt">สัปดาห์นี้รวม {Math.round(MUSCLES.reduce((n, m) => n + vol[m], 0)).toLocaleString()} kg</div></div>
    </div>
  )
}

function ExerciseTab() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const logged = [...map.values()].filter(e => exerciseHistory(st.sessions, e.id).length)
  const [sel, setSel] = useState('')
  const id = logged.some(e => e.id === sel) ? sel : logged[0]?.id
  if (!id) return <div className="card sub">ยังไม่มีประวัติรายท่า</div>
  const rows = exerciseHistory(st.sessions, id)
  return (
    <div className="stack">
      <select value={id} onChange={e => setSel(e.target.value)} aria-label="เลือกท่า">{logged.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
      <div className="card"><b>e1RM</b><LineChart points={rows.filter(r => r.e1rm > 0).map(r => ({ t: new Date(r.date).getTime(), v: r.e1rm }))} unit=" kg" /></div>
      <div className="card"><b>Volume ต่อ Session</b><LineChart color="var(--up)" points={rows.map(r => ({ t: new Date(r.date).getTime(), v: r.volume }))} unit=" kg" /></div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table><thead><tr><th>วันที่</th><th>เซ็ต</th><th>RIR</th><th>Vol</th><th>e1RM</th></tr></thead>
          <tbody>{rows.slice().reverse().map(r => <tr key={r.sessionId}><td>{fmtDate(r.date)}</td><td className="num">{r.sets.map(s => `${fmtKg(s.weight)}×${s.reps}`).join(', ')}</td><td>{r.avgRir ?? '—'}</td><td className="num">{Math.round(r.volume)}</td><td className="num">{r.e1rm || '—'}</td></tr>)}</tbody></table>
      </div>
    </div>
  )
}

function Body() {
  const st = useStore()
  const [date, setDate] = useState(isoDate())
  const [kg, setKg] = useState('')
  const stats = bodyWeightStats(st.bodyWeights)
  const n = parseFloat(kg.replace(',', '.'))
  const valid = Number.isFinite(n) && n >= 20 && n <= 400
  const [range, setRange] = useState(90)
  const cutoff = Date.now() - range * 86_400_000
  const pts = st.bodyWeights.filter(b => new Date(b.date).getTime() >= cutoff).map(b => ({ t: new Date(b.date).getTime(), v: b.kg }))
  const sign = (x: number | null) => (x === null ? '—' : `${x > 0 ? '+' : ''}${x} kg`)
  return (
    <div className="stack">
      <div className="card stack">
        <b>บันทึกน้ำหนักตัว</b>
        <div className="grid2">
          <label className="field"><span>วันที่</span><input type="date" value={date} max={isoDate()} onChange={e => setDate(e.target.value)} /></label>
          <label className="field"><span>น้ำหนัก (kg)</span><input inputMode="decimal" value={kg} placeholder="63.2" onChange={e => setKg(e.target.value)} /></label>
        </div>
        <button className="btn primary" disabled={!valid || !date} onClick={() => { st.addBodyWeight(date, n); setKg('') }}>บันทึก</button>
        {kg && !valid && <div className="sub" role="alert" style={{ color: 'var(--down)' }}>น้ำหนักต้องอยู่ระหว่าง 20–400 kg</div>}
      </div>
      <div className="grid3">
        <div className="card"><div className="sub">เฉลี่ย 7 วัน</div><div className="num" style={{ fontSize: 24 }}>{stats.avg7 ? stats.avg7.avg : '—'}</div></div>
        <div className="card"><div className="sub">รายสัปดาห์</div><div className="num" style={{ fontSize: 24 }}>{sign(stats.weeklyChange)}</div></div>
        <div className="card"><div className="sub">รายเดือน</div><div className="num" style={{ fontSize: 24 }}>{sign(stats.monthlyChange)}</div></div>
      </div>
      {stats.note && <div className="sub">{stats.note}</div>}
      <Chips<number> value={range} onChange={setRange} options={RANGES} />
      <div className="card"><LineChart points={pts} unit=" kg" empty="บันทึกอย่างน้อย 2 ครั้งเพื่อดูกราฟ" /></div>
      <div className="card">{st.bodyWeights.slice().reverse().slice(0, 14).map(b => (
        <div key={b.id} className="setline" style={{ gridTemplateColumns: '1fr auto 36px' }}><span>{fmtDate(b.date, true)}</span><span className="num">{b.kg} kg</span><button className="xbtn" aria-label="ลบ" onClick={() => st.deleteBodyWeight(b.id)}>×</button></div>))}
        {!st.bodyWeights.length && <span className="sub">ยังไม่มีข้อมูล</span>}</div>
    </div>
  )
}
