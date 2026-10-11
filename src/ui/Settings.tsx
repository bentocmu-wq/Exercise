import { useRef, useState } from 'react'
import { allExercises, exerciseMap, snapshot, useStore } from '../store/store'
import { download, exportCsv, exportJson } from '../store/exportData'
import { DEFAULT_PROFILE, ProfileForm } from './ProfileForm'
import { Sheet } from './kit'

export function Settings() {
  const st = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const stamp = new Date().toISOString().slice(0, 10)

  const onImport = async (f?: File) => {
    if (!f) return
    const res = st.importData(await f.text())
    setMsg(res.ok ? { ok: true, text: 'กู้คืนข้อมูลสำเร็จ' } : { ok: false, text: res.error })
    if (file.current) file.current.value = ''
  }

  return (
    <div>
      <h1 className="h1">โปรไฟล์ & ข้อมูล</h1>
      <div className="card">
        <ProfileForm
          initial={st.profile ?? DEFAULT_PROFILE} submitLabel="บันทึกโปรไฟล์" regenerateHint
          onSubmit={(p, regen) => { st.saveProfile(p, regen); setMsg({ ok: true, text: regen ? 'บันทึกแล้ว และสร้างโปรแกรมใหม่' : 'บันทึกแล้ว' }) }}
        />
      </div>

      <h2 className="h2">Backup / Export</h2>
      <div className="card stack">
        <div className="grid2">
          <button className="btn" onClick={() => download(`ironlog-backup-${stamp}.json`, exportJson(snapshot(st)), 'application/json')}>Export JSON</button>
          <button className="btn" onClick={() => download(`ironlog-sets-${stamp}.csv`, exportCsv(st, exerciseMap(st)), 'text/csv')}>Export CSV</button>
        </div>
        <button className="btn ghost" onClick={() => file.current?.click()}>Restore จากไฟล์ JSON</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => onImport(e.target.files?.[0])} />
        <p className="sub" style={{ margin: 0 }}>ข้อมูลทั้งหมดเก็บในเครื่องนี้ (ใช้ offline ได้) — ควร Export สำรองเป็นระยะ โดยเฉพาะก่อนล้างข้อมูลเบราว์เซอร์ หรือเปลี่ยนเครื่อง</p>
        {msg && <div className={`card flat`} role="status" style={{ color: msg.ok ? 'var(--up)' : 'var(--down)' }}>{msg.text}</div>}
      </div>

      <h2 className="h2">สถานะระบบ</h2>
      <div className="card stack">
        <div className="row between"><span>การเก็บข้อมูล</span><span className="badge up">Local · Offline</span></div>
        <div className="row between"><span>Cloud sync หลายอุปกรณ์</span><span className="badge">ยังไม่เปิดใช้งาน (TODO)</span></div>
        <div className="sub">ท่าทั้งหมด {allExercises(st).length} ท่า · Sessions {st.sessions.filter(s => s.endedAt).length} · เซ็ตที่บันทึก {st.sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0)}</div>
      </div>

      <h2 className="h2">ความปลอดภัย</h2>
      <div className="card sub">IronLog ไม่ใช่อุปกรณ์การแพทย์และไม่วินิจฉัยโรค หากมีอาการปวดหรือบาดเจ็บ ให้หยุดหรือปรับท่าตามความเหมาะสม และพิจารณาปรึกษาแพทย์/นักกายภาพ/ผู้ฝึกสอน</div>

      <div className="mt2"><button className="btn danger" onClick={() => setConfirmReset(true)}>ล้างข้อมูลทั้งหมด</button></div>
      {confirmReset && (
        <Sheet onClose={() => setConfirmReset(false)}>
          <h2 className="h2" style={{ marginTop: 0 }}>ล้างข้อมูลทั้งหมด?</h2>
          <p>โปรไฟล์ โปรแกรม ประวัติการฝึก น้ำหนักตัว และ PR จะถูกลบถาวร กู้คืนได้เฉพาะถ้ามีไฟล์ Backup</p>
          <div className="grid2">
            <button className="btn" onClick={() => setConfirmReset(false)}>ยกเลิก</button>
            <button className="btn danger" onClick={() => { st.resetAll(); setConfirmReset(false) }}>ลบถาวร</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
