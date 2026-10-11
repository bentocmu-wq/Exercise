export const round = (n: number, d = 1): number => {
  const f = 10 ** d
  return Math.round(n * f) / f
}
export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export const isoDate = (d: Date = new Date()): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export const parseDate = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
export const daysBetween = (a: Date, b: Date): number =>
  Math.round((parseDate(isoDate(b)).getTime() - parseDate(isoDate(a)).getTime()) / 86_400_000)
export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
/** Monday-based week start. */
export const startOfWeek = (d: Date): Date => {
  const x = parseDate(isoDate(d))
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}
export const fmtKg = (n: number): string => (Number.isInteger(n) ? String(n) : String(round(n, 2)))
