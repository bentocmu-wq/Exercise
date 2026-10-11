import { useMemo, useState } from 'react'
import { exerciseMap, useStore } from '../store/store'
import { finished, sessionAvgRir, sessionMinutes, sessionVolume } from '../engine/analytics'
import { PR_LABEL } from '../engine/pr'
import { fmtKg } from '../engine/util'
import { Sheet, fmtDate } from './kit'

export function History() {
  const st = useStore()
  const map = useMemo(() => exerciseMap(st), [st.customExercises])
  const [open, setOpen] = useState<string | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const list = finished(st.sessions).slice().reverse()
  return (
    <div>
      <h1 className="h1">ประวัติ</h1>
      {!list.length && <div className="card sub">ยังไม่มี Workout ที่บันทึก — เริ่มฝึกจากแท็บ “วันนี้”</div>}
      <div className="stack">
        {list.map(s => {
          const prs = st.records.filter(r => r.sessionId === s.id)
          const isOpen = open === s.id
          return (
            <div className="card" key={s.id}>
              <button style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                <div className="row between"><b>{s.name}</b><span className="sub">{fmtDate(s.startedAt, true)}</span></div>
                <div className="sub">{sessionMinutes(s)} นาที · {sessionVolume(s).toLocaleString()} kg · {s.exercises.length} ท่า · RIR เฉลี่ย {sessionAvgRir(s) ?? '—'}{s.deload ? ' · Deload' : ''}</div>
                {prs.length > 0 && <span className="badge pr" style={{ marginTop: 6 }}>🔥 {prs.length} PR</span>}
              </button>
              {isOpen && (
                <div className="mt">
                  {s.readiness && <div className="sub">Readiness {s.readiness.score}% (นอน {s.readiness.sleep} · พลังงาน {s.readiness.energy} · เมื่อย {s.readiness.soreness} · เครียด {s.readiness.stress})</div>}
                  {s.exercises.map(e => (
                    <div key={e.exerciseId} className="mt">
                      <div className="row between"><span>{map.get(e.exerciseId)?.name}</span>{e.painFlag && <span className="badge down">ปวด</span>}</div>
                      <div className="num sub" style={{ fontSize: 16 }}>{e.sets.map(x => `${fmtKg(x.weight)}×${x.reps}${x.rir !== undefined ? `@${x.rir}` : ''}`).join('  ')}</div>
                      {e.painNote && <div className="sub">⚠ {e.painNote}</div>}
                      {e.notes && <div className="sub">โน้ต: {e.notes}</div>}
                    </div>
                  ))}
                  {prs.length > 0 && <div className="mt">{prs.map(r => <span key={r.id} className="badge pr" style={{ marginRight: 6 }}>{map.get(r.exerciseId)?.name} · {PR_LABEL[r.kind]}</span>)}</div>}
                  <button className="link mt" style={{ color: 'var(--down)' }} onClick={() => setDel(s.id)}>ลบ Workout นี้</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {del && (
        <Sheet onClose={() => setDel(null)}>
          <h2 className="h2" style={{ marginTop: 0 }}>ลบ Workout นี้?</h2>
          <p className="sub">ข้อมูลเซ็ตและ PR ของ Session นี้จะหายถาวร และคำแนะนำครั้งถัดไปจะอิงข้อมูลที่เหลือ</p>
          <div className="grid2"><button className="btn" onClick={() => setDel(null)}>ยกเลิก</button><button className="btn danger" onClick={() => { st.deleteSession(del); setDel(null) }}>ลบ</button></div>
        </Sheet>
      )}
    </div>
  )
}
