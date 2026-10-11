import { useEffect, useRef, useState, type ReactNode } from 'react'

export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t) }, [intervalMs])
  return now
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export function Chips<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label?: string
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.v)} className={`chip ${o.v === value ? 'on' : ''}`} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  )
}

/** Big numeric field with − / + steppers; the number is also directly editable. */
export function Counter({ value, onChange, step, min = 0, max = 1000, label, decimals = 2 }: {
  value: number | null; onChange: (n: number) => void; step: number; min?: number; max?: number; label: string; decimals?: number
}) {
  const [text, setText] = useState<string>(value === null ? '' : String(value))
  const last = useRef(value)
  useEffect(() => { if (value !== last.current) { last.current = value; setText(value === null ? '' : String(value)) } }, [value])
  const commit = (n: number) => {
    const v = Math.min(max, Math.max(min, Math.round(n * 10 ** decimals) / 10 ** decimals))
    last.current = v; setText(String(v)); onChange(v)
  }
  return (
    <div className="counter">
      <button className="step" aria-label={`${label} ลด`} onClick={() => commit((value ?? 0) - step)}>−</button>
      <input
        inputMode="decimal" aria-label={label} value={text} placeholder="0"
        onFocus={e => e.target.select()}
        onChange={e => {
          setText(e.target.value)
          const n = parseFloat(e.target.value.replace(',', '.'))
          if (Number.isFinite(n)) { last.current = Math.min(max, Math.max(min, n)); onChange(last.current) }
        }}
        onBlur={() => { const n = parseFloat(text.replace(',', '.')); if (Number.isFinite(n)) commit(n); else setText(value === null ? '' : String(value)) }}
      />
      <button className="step" aria-label={`${label} เพิ่ม`} onClick={() => commit((value ?? 0) + step)}>+</button>
      <label>{label}</label>
    </div>
  )
}

export function NumField({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <label className="field"><span>{label}</span>
      <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
        onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
    </label>
  )
}

export function LineChart({ points, height = 170, unit = '', empty = 'ยังไม่มีข้อมูลพอจะแสดงกราฟ', color = 'var(--info)' }: {
  points: { t: number; v: number }[]; height?: number; unit?: string; empty?: string; color?: string
}) {
  if (points.length < 2) return <div className="sub" style={{ padding: '24px 0', textAlign: 'center' }}>{empty}</div>
  const W = 360, H = height, pl = 36, pr = 8, pt = 10, pb = 22
  const xs = points.map(p => p.t), ys = points.map(p => p.v)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  let y0 = Math.min(...ys), y1 = Math.max(...ys)
  const padY = (y1 - y0) * 0.15 || 1
  y0 -= padY; y1 += padY
  const X = (t: number) => pl + ((t - x0) / (x1 - x0 || 1)) * (W - pl - pr)
  const Y = (v: number) => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
  const ticks = [y0 + padY, (y0 + y1) / 2, y1 - padY]
  const fmt = (t: number) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`กราฟ ${points.length} จุด ล่าสุด ${points[points.length - 1].v}${unit}`}>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={pl - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(v * 10) / 10}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={i} cx={X(p.t)} cy={Y(p.v)} r={i === points.length - 1 ? 4.5 : 2.5} fill={color} />)}
      <text x={pl} y={H - 5} fontSize="11" fill="var(--muted)">{fmt(x0)}</text>
      <text x={W - pr} y={H - 5} fontSize="11" fill="var(--muted)" textAnchor="end">{fmt(x1)}</text>
    </svg>
  )
}

export function BarChart({ bars, height = 150, unit = '' }: { bars: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...bars.map(b => b.value))
  const W = 360, H = height, pb = 22, gap = 6
  const bw = (W - gap * (bars.length - 1)) / bars.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`แท่งกราฟ ${bars.length} สัปดาห์`}>
      {bars.map((b, i) => {
        const h = (b.value / max) * (H - pb - 16)
        const x = i * (bw + gap)
        return (
          <g key={i}>
            <rect x={x} y={H - pb - h} width={bw} height={Math.max(h, b.value ? 2 : 0)} rx="4" fill={i === bars.length - 1 ? 'var(--text)' : 'var(--info)'} opacity={i === bars.length - 1 ? 1 : .7} />
            {b.value > 0 && <text x={x + bw / 2} y={H - pb - h - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{b.value >= 1000 ? `${(b.value / 1000).toFixed(1)}k` : b.value}{unit}</text>}
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export const Icon = {
  today: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h3M18 12h3M6 7v10M18 7v10M9 9v6M15 9v6M9 12h6" strokeLinecap="round" /></svg>,
  program: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" /></svg>,
  history: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" strokeLinecap="round" /></svg>,
  stats: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5" strokeLinecap="round" /></svg>
}

export const fmtDate = (iso: string, long = false): string =>
  new Date(iso).toLocaleDateString('th-TH', long ? { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
