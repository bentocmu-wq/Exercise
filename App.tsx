import { useState } from 'react'
import { useStore } from './store/store'
import { Dashboard } from './ui/Dashboard'
import { Workout } from './ui/Workout'
import { Program } from './ui/Program'
import { History } from './ui/History'
import { Stats } from './ui/Stats'
import { Settings } from './ui/Settings'
import { DEFAULT_PROFILE, ProfileForm } from './ui/ProfileForm'
import { Icon } from './ui/kit'

type Tab = 'today' | 'program' | 'history' | 'stats' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'วันนี้' }, { id: 'program', label: 'โปรแกรม' }, { id: 'history', label: 'ประวัติ' },
  { id: 'stats', label: 'สถิติ' }, { id: 'settings', label: 'โปรไฟล์' }
]

export default function App() {
  const profile = useStore(s => s.profile)
  const saveProfile = useStore(s => s.saveProfile)
  const hasActive = useStore(s => !!s.activeSessionId && s.sessions.some(x => x.id === s.activeSessionId))
  const [tab, setTab] = useState<Tab>('today')
  const [working, setWorking] = useState(false)

  if (!profile) {
    return (
      <main className="app">
        <h1 className="h1">IronLog</h1>
        <p className="sub">ตั้งค่าโปรไฟล์ แล้วระบบจะสร้างโปรแกรมและเริ่มคำนวณน้ำหนักที่ควรยกให้ทุก Session</p>
        <div className="card"><ProfileForm initial={DEFAULT_PROFILE} submitLabel="สร้างโปรแกรมของฉัน" onSubmit={(p) => saveProfile(p, true)} /></div>
      </main>
    )
  }

  const inWorkout = working || (tab === 'today' && hasActive)
  return (
    <>
      <main className="app">
        {tab === 'today' && (inWorkout && hasActive ? <Workout onExit={() => setWorking(false)} /> : <Dashboard onStart={() => setWorking(true)} onGoProgram={() => setTab('program')} />)}
        {tab === 'program' && <Program />}
        {tab === 'history' && <History />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="nav" aria-label="เมนูหลัก">
        <div className="nav-in">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              {t.id === 'today' ? Icon.today : t.id === 'program' ? Icon.program : t.id === 'history' ? Icon.history : t.id === 'stats' ? Icon.stats : Icon.settings}
              <span>{t.id === 'today' && hasActive ? 'กำลังฝึก' : t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
