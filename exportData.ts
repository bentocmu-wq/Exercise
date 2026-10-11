import type { Data } from './store'
import { snapshot } from './store'
import type { Exercise } from '../types'
import { calculateE1RM } from '../engine/e1rm'

export function exportJson(d: Data): string {
  return JSON.stringify({ app: 'ironlog', version: 1, exportedAt: new Date().toISOString(), data: snapshot(d) }, null, 2)
}

const esc = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(d: Data, exercises: Map<string, Exercise>): string {
  const head = ['date', 'session', 'exercise', 'set', 'weight_kg', 'reps', 'rir', 'rpe', 'volume', 'e1rm', 'pain', 'notes']
  const rows: string[] = [head.join(',')]
  for (const s of d.sessions.filter(x => x.endedAt))
    for (const e of s.exercises)
      for (const x of e.sets)
        rows.push([
          s.startedAt, s.name, exercises.get(e.exerciseId)?.name ?? e.exerciseId, x.setNumber, x.weight, x.reps,
          x.rir, x.rpe, x.weight * x.reps, calculateE1RM(x.weight, x.reps), e.painFlag ? 'yes' : '', e.notes
        ].map(esc).join(','))
  return rows.join('\n')
}

export function download(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
