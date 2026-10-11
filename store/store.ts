import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  BodyWeightEntry, Exercise, PersonalRecord, PlannedExercise, PRKind, Profile, Program,
  ReadinessInput, Recommendation, Session, SessionExercise, SetLog
} from '../types'
import { SEED_EXERCISES } from '../data/exercises'
import { calculateNextWeight } from '../engine/progression'
import { calculateReadiness } from '../engine/readiness'
import { detectPR, detectVolumePR } from '../engine/pr'
import { calculateVolume } from '../engine/volume'
import { currentMeso, deloadSets, rirFor } from '../engine/periodization'
import { generateProgram } from '../engine/generator'
import { addDays, isoDate, uid } from '../engine/util'
import { coachSummary } from '../engine/coach'
import { exerciseHistory, finished } from '../engine/analytics'

export interface Data {
  profile?: Profile
  program?: Program
  customExercises: Exercise[]
  sessions: Session[]
  activeSessionId?: string
  bodyWeights: BodyWeightEntry[]
  records: PersonalRecord[]
  /** ISO date until which a manual deload week is active */
  deloadUntil?: string
}

interface Actions {
  saveProfile: (p: Profile, regenerate: boolean) => void
  setProgram: (p: Program) => void
  addCustomExercise: (e: Omit<Exercise, 'id' | 'custom'>) => Exercise
  startSession: (dayId: string, readiness?: ReadinessInput) => string | null
  logSet: (exIdx: number, s: { weight: number; reps: number; rir?: number; restTime?: number }) => PRKind[]
  removeSet: (exIdx: number, setId: string) => void
  setPain: (exIdx: number, flag: boolean, note?: string) => void
  setNotes: (exIdx: number, notes: string) => void
  completeExercise: (exIdx: number) => string
  finishSession: () => Session | null
  discardSession: () => void
  deleteSession: (id: string) => void
  addBodyWeight: (date: string, kg: number) => void
  deleteBodyWeight: (id: string) => void
  startDeloadWeek: () => void
  cancelDeload: () => void
  importData: (json: string) => { ok: true } | { ok: false; error: string }
  resetAll: () => void
}

export type Store = Data & Actions

const empty: Data = { customExercises: [], sessions: [], bodyWeights: [], records: [] }

export const allExercises = (s: Pick<Data, 'customExercises'>): Exercise[] => [...SEED_EXERCISES, ...s.customExercises]
export const exerciseMap = (s: Pick<Data, 'customExercises'>): Map<string, Exercise> => new Map(allExercises(s).map(e => [e.id, e]))
export const activeSession = (s: Data): Session | undefined => s.sessions.find(x => x.id === s.activeSessionId)

/** The next day in the rotation after the most recently finished session. */
export function nextDayIndex(s: Data): number {
  if (!s.program?.days.length) return 0
  const last = finished(s.sessions).slice(-1)[0]
  if (!last) return 0
  const i = s.program.days.findIndex(d => d.id === last.programDayId)
  return i < 0 ? 0 : (i + 1) % s.program.days.length
}

export const isDeloadActive = (s: Data, now = new Date()): boolean => !!s.deloadUntil && s.deloadUntil >= isoDate(now)

function recommend(
  s: Data, ex: Exercise, planned: PlannedExercise, readinessScore: number | null
): Recommendation {
  const last = finished(s.sessions).slice().reverse().find(x => x.exercises.some(e => e.exerciseId === ex.id && e.sets.length))
  const prevEx = last?.exercises.find(e => e.exerciseId === ex.id)
  return calculateNextWeight({
    previousSets: (prevEx?.sets ?? []).map(x => ({ weight: x.weight, reps: x.reps, rir: x.rir })),
    targetRepMin: planned.repMin, targetRepMax: planned.repMax,
    targetRirMin: planned.rirMin, targetRirMax: planned.rirMax,
    exerciseType: ex.type, increment: planned.increment ?? ex.increment,
    plannedSets: planned.sets, readinessScore, painFlag: prevEx?.painFlag, painNote: prevEx?.painNote
  })
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const updateActive = (fn: (s: Session) => Session) =>
        set(st => ({ sessions: st.sessions.map(x => (x.id === st.activeSessionId ? fn(x) : x)) }))
      const updateEx = (idx: number, fn: (e: SessionExercise) => SessionExercise) =>
        updateActive(s => ({ ...s, exercises: s.exercises.map((e, i) => (i === idx ? fn(e) : e)) }))

      return {
        ...empty,

        saveProfile: (p, regenerate) => {
          set({ profile: p })
          if (regenerate || !get().program) {
            set({ program: generateProgram({ goal: p.goal, days: p.daysPerWeek, level: p.level, sessionMinutes: p.sessionMinutes, equipment: p.equipment }, allExercises(get())) })
          }
          const today = isoDate()
          if (!get().bodyWeights.some(b => b.date === today) && !get().bodyWeights.length)
            set(st => ({ bodyWeights: [...st.bodyWeights, { id: uid(), date: today, kg: p.bodyWeightKg }] }))
        },

        setProgram: program => set({ program }),

        addCustomExercise: e => {
          const ex: Exercise = { ...e, id: `custom-${uid()}`, custom: true }
          set(st => ({ customExercises: [...st.customExercises, ex] }))
          return ex
        },

        startSession: (dayId, readinessInput) => {
          const st = get()
          const program = st.program
          const day = program?.days.find(d => d.id === dayId)
          if (!program || !day) return null
          if (st.activeSessionId && st.sessions.some(x => x.id === st.activeSessionId)) return st.activeSessionId
          const meso = currentMeso(program)
          const deload = meso.deload || isDeloadActive(st)
          const readiness = readinessInput ? calculateReadiness(readinessInput) ?? undefined : undefined
          const map = exerciseMap(st)
          const exercises: SessionExercise[] = day.exercises.flatMap(p => {
            const def = map.get(p.exerciseId)
            if (!def) return []
            const [rirMin, rirMax] = deload ? [3, 4] : rirFor(meso, def.type)
            let sets = p.sets
            if (deload) sets = deloadSets(sets)
            else if (readiness?.advice === 'reduce_volume' && sets > 2) sets -= 1
            const planned: PlannedExercise = { ...p, sets, rirMin, rirMax }
            return [{
              exerciseId: p.exerciseId, planned, sets: [], completed: false, painFlag: false,
              recommendation: recommend(st, def, planned, readiness?.score ?? null)
            }]
          })
          const session: Session = {
            id: uid(), programDayId: day.id, name: day.name, startedAt: new Date().toISOString(),
            readiness, exercises, deload, mesoLabel: meso.label
          }
          set(s => ({ sessions: [...s.sessions, session], activeSessionId: session.id }))
          return session.id
        },

        logSet: (exIdx, input) => {
          const st = get()
          const session = activeSession(st)
          const ex = session?.exercises[exIdx]
          if (!session || !ex) return []
          const weight = Number.isFinite(input.weight) ? Math.max(0, input.weight) : 0
          const reps = Number.isFinite(input.reps) ? Math.max(0, Math.round(input.reps)) : 0
          if (reps <= 0) return [] // UI validates; defensive
          const log: SetLog = {
            id: uid(), setNumber: ex.sets.length + 1, weight, reps,
            rir: input.rir, restTime: input.restTime, timestamp: new Date().toISOString()
          }
          // PR baseline = all finished history + earlier sets of this exercise today
          const prior = [
            ...finished(st.sessions).flatMap(x => x.exercises.filter(e => e.exerciseId === ex.exerciseId).flatMap(e => e.sets)),
            ...ex.sets
          ].map(x => ({ weight: x.weight, reps: x.reps }))
          const kinds = detectPR({ weight, reps }, prior)
          updateEx(exIdx, e => ({ ...e, sets: [...e.sets, log] }))
          if (kinds.length) {
            const date = isoDate()
            const recs: PersonalRecord[] = kinds.map(kind => ({
              id: uid(), exerciseId: ex.exerciseId, kind, weight, reps, date, sessionId: session.id,
              value: kind === 'weight' ? weight : kind === 'reps' ? reps : Math.round(weight * (1 + reps / 30) * 10) / 10
            }))
            set(s => ({ records: [...s.records, ...recs] }))
          }
          return kinds
        },

        removeSet: (exIdx, setId) =>
          updateEx(exIdx, e => ({ ...e, sets: e.sets.filter(x => x.id !== setId).map((x, i) => ({ ...x, setNumber: i + 1 })) })),

        setPain: (exIdx, flag, note) => updateEx(exIdx, e => ({ ...e, painFlag: flag, painNote: flag ? note : undefined })),
        setNotes: (exIdx, notes) => updateEx(exIdx, e => ({ ...e, notes })),

        completeExercise: exIdx => {
          const st = get()
          const session = activeSession(st)
          const ex = session?.exercises[exIdx]
          if (!session || !ex) return ''
          const def = exerciseMap(st).get(ex.exerciseId)
          updateEx(exIdx, e => ({ ...e, completed: true }))
          // volume PR vs previous sessions
          const vol = calculateVolume(ex.sets)
          const prevVols = exerciseHistory(st.sessions, ex.exerciseId).map(r => r.volume)
          if (detectVolumePR(vol, prevVols)) {
            const rec: PersonalRecord = { id: uid(), exerciseId: ex.exerciseId, kind: 'volume', value: vol, weight: 0, reps: 0, date: isoDate(), sessionId: session.id }
            set(s => ({ records: [...s.records, rec] }))
          }
          return coachSummary(def?.name ?? 'Exercise', ex.sets, ex.planned, {
            type: def?.type ?? 'compound', increment: ex.planned.increment ?? def?.increment ?? 2.5, painFlag: ex.painFlag
          })
        },

        finishSession: () => {
          const st = get()
          const session = activeSession(st)
          if (!session) return null
          const kept = session.exercises.filter(e => e.sets.length)
          const done: Session = { ...session, exercises: kept, endedAt: new Date().toISOString() }
          set(s => ({ sessions: s.sessions.map(x => (x.id === session.id ? done : x)), activeSessionId: undefined }))
          return done
        },

        discardSession: () =>
          set(s => ({ sessions: s.sessions.filter(x => x.id !== s.activeSessionId), records: s.records.filter(r => r.sessionId !== s.activeSessionId), activeSessionId: undefined })),

        deleteSession: id => set(s => ({ sessions: s.sessions.filter(x => x.id !== id), records: s.records.filter(r => r.sessionId !== id), activeSessionId: s.activeSessionId === id ? undefined : s.activeSessionId })),

        addBodyWeight: (date, kg) => {
          if (!Number.isFinite(kg) || kg < 20 || kg > 400) return
          set(s => ({ bodyWeights: [...s.bodyWeights.filter(b => b.date !== date), { id: uid(), date, kg }].sort((a, b) => a.date.localeCompare(b.date)) }))
        },
        deleteBodyWeight: id => set(s => ({ bodyWeights: s.bodyWeights.filter(b => b.id !== id) })),

        startDeloadWeek: () => set({ deloadUntil: isoDate(addDays(new Date(), 6)) }),
        cancelDeload: () => set({ deloadUntil: undefined }),

        importData: json => {
          try {
            const raw = JSON.parse(json) as { app?: string; data?: Partial<Data> }
            const d = raw?.data
            if (raw?.app !== 'ironlog' || !d || typeof d !== 'object') return { ok: false, error: 'ไฟล์นี้ไม่ใช่ backup ของ IronLog' }
            if (!Array.isArray(d.sessions) || !Array.isArray(d.bodyWeights) || !Array.isArray(d.records) || !Array.isArray(d.customExercises))
              return { ok: false, error: 'โครงสร้างข้อมูลไม่ครบ (sessions / bodyWeights / records / customExercises)' }
            set({ ...empty, ...d, activeSessionId: undefined })
            return { ok: true }
          } catch (e) {
            return { ok: false, error: `อ่านไฟล์ไม่สำเร็จ: ${(e as Error).message}` }
          }
        },

        resetAll: () => set({ ...empty, profile: undefined, program: undefined, activeSessionId: undefined, deloadUntil: undefined })
      }
    },
    {
      name: 'ironlog:v1',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: k => { try { return localStorage.getItem(k) } catch { return null } },
        setItem: (k, v) => { try { localStorage.setItem(k, v) } catch (e) { if (typeof localStorage !== 'undefined') console.error('Storage write failed', e) } },
        removeItem: k => { try { localStorage.removeItem(k) } catch { /* ignore */ } }
      })),
      partialize: s => ({
        profile: s.profile, program: s.program, customExercises: s.customExercises, sessions: s.sessions,
        activeSessionId: s.activeSessionId, bodyWeights: s.bodyWeights, records: s.records, deloadUntil: s.deloadUntil
      })
    }
  )
)

export const snapshot = (s: Data): Data => ({
  profile: s.profile, program: s.program, customExercises: s.customExercises, sessions: s.sessions,
  activeSessionId: undefined, bodyWeights: s.bodyWeights, records: s.records, deloadUntil: s.deloadUntil
})
