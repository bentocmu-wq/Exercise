# IronLog — Strength & Hypertrophy Training System (PWA)

PLAN → TRAIN → LOG → ANALYZE → PROGRESS → ADJUST. Offline-first PWA (Vite + React + TypeScript), deploys to Vercel as a static site. No backend, no secrets, no environment variables needed.

## Deploy to Vercel

```bash
npm install
npm run build      # typecheck + production build -> dist/
```
- **Dashboard**: push this folder to GitHub → Vercel → *Add New Project* → import. Framework is auto-detected (Vite); `vercel.json` already sets build command, output dir and the SPA rewrite.
- **CLI**: `npx vercel` (preview) / `npx vercel --prod`.
- Open the deployed URL on your phone → *Add to Home Screen*. After the first load it works with no connection.

Local dev: `npm run dev` · tests: `npm test` · types: `npm run typecheck`.

## Architecture

```
UI (React screens)  →  Zustand store (persisted to localStorage, versioned key `ironlog:v1`)
                              ↓ pure functions
                         src/engine/*   (no React, no I/O, fully unit-tested)
```
- **Engine** holds all coaching logic: progression, e1RM, volume, hard sets, readiness, PR, deload, periodization, program generator, body-weight stats.
- **Store** owns state + actions (start session, log set, PR detection, finish, import/export). Every recommendation is **snapshotted into the session** (`SessionExercise.recommendation`, incl. `evidence[]`) so any advice can be traced back to the data that produced it.
- **Offline**: all data is local; the service worker (vite-plugin-pwa) precaches the app shell and fonts.

## Data model (src/types.ts)

| Entity | Where | Notes |
|---|---|---|
| User | `Profile` | age, sex, height, body weight, goal, level, days/week, session minutes, equipment |
| Exercise / MuscleGroup | `data/exercises.ts` + `customExercises` | 9 muscle groups; primary + secondary muscles; type; equipment; increment |
| WorkoutProgram | `Program` → `ProgramDay` → `PlannedExercise` | sets, rep range, RIR range, rest, tempo, increment override, order |
| WorkoutSession / WorkoutExercise | `Session` → `SessionExercise` | readiness, deload flag, meso label, pain flag, notes (separate from performance) |
| SetLog | `SetLog` | id, setNumber, weight, reps, rir, rpe, restTime, timestamp, notes |
| BodyWeight | `BodyWeightEntry` | date, kg |
| Readiness | `ReadinessLog` | sleep, energy, soreness, stress, score, advice |
| PersonalRecord | `PersonalRecord` | weight / reps / e1rm / volume |
| ProgressionRule | `engine/progression.ts` | code, not data |
| ExerciseHistory | derived (`analytics.exerciseHistory`) | never stored twice |

Migration: the persisted state is versioned (`version: 1`). For a future schema change add a `migrate` function to the `persist` options in `store/store.ts`. Backups carry `{ app: 'ironlog', version }` and are validated on import.

## Screen flow

`Onboarding (profile → auto program)` → **Today** (next day in rotation, readiness check, deload alerts) → **Workout** (exercise tabs, previous sets, recommendation + reason + evidence, quick-log counter, RIR chips, rest timer, pain flag, notes, PR overlay, coach message per exercise) → **Summary**.
Other tabs: **Program** (generate / custom split / edit sets, reps, RIR, rest, tempo, increment, order, add custom exercise), **History**, **Stats** (overview, e1RM 1M/3M/6M/1Y, muscle hard-sets & volume, per-exercise history, body weight), **Profile & data** (edit profile, JSON/CSV export, restore, reset).

## Progressive overload algorithm (`calculateNextWeight`)

Double progression, RIR-aware. Working sets = sets within 5 % of the heaviest weight of the last session.

1. No history → `START`, no number invented.
2. Pain flagged last time → `HOLD` + warning (never auto-increase until reassessed).
3. Every working set missed the range badly (≥ 2 reps under the minimum on most sets, or on a failure-level set) → `DECREASE` 5 % (10 % if far below), rounded to the increment, at least one step down.
4. All planned sets at the top rep → `INCREASE` one increment (two for compounds if RIR ≥ target + 2). Exception: if RIR averaged < 1 (grinding every set) → `HOLD`.
5. Inside the range but RIR ≥ target max + 2 → `INCREASE` (load is too light).
6. Otherwise `HOLD` and chase reps (`nextRepTarget`).
7. Readiness gate: < 50 % blocks an increase; < 35 % lowers load ~7.5 %.

Output: `{ recommendedWeight, action, reason, confidence, nextRepTarget, evidence[], warning? }` — reason text is Thai, with the numbers it used.

Other engines: Epley e1RM (sets ≤ 12 reps), volume = Σ weight×reps, hard set = RIR ≤ 3 (secondary muscles count 0.5), weekly set bands depend on level and tighten if that muscle's e1RM is falling, readiness = 30 % sleep + 30 % energy + 20 % (1−soreness) + 20 % (1−stress), deload = ≥ 2 independent fatigue signals (e1RM trend, low RIR, sustained high volume, low readiness, soreness, 8+ weeks without deload), mesocycle RIR 3 → 2–3 → 2 → 1–2 → deload (auto-repeats).

## Seed data & migration
Exercise database (≈ 41 exercises) is seeded from code (`src/data/exercises.ts`); there is no SQL migration because storage is local. The program generator builds Full Body / Upper-Lower / PPL+UL / PPL×2 from templates, filtered by your equipment and trimmed to your session length.

## Known limits / TODO (nothing here is faked in the UI)
- **Cloud sync is not implemented** (Settings shows "ยังไม่เปิดใช้งาน"). Data lives in this browser's localStorage → export JSON regularly. Plan: Supabase (Postgres + RLS) with the entities above, last-write-wins by `timestamp`.
- Bodyweight exercises (pull-up, dips) track *added* weight only; e1RM ignores body mass.
- No warm-up-set flag (hard-set logic already ignores light sets via RIR).
- `rpe` exists in the data model/CSV but is not entered in the UI (RIR is primary).
- The UI was verified by typecheck, production build and store-level integration tests, not by automated browser tests.

## Roadmap
1. Supabase auth + sync · 2. Warm-up sets & supersets · 3. Bodyweight-aware e1RM · 4. Plate calculator · 5. Auto-adjust next week's sets from hard-set status · 6. Apple Health / Google Fit body-weight import.

## Tests
`npm test` — 58 tests: progression (spec scenarios + edge cases: weight 0, failed set, missing RIR, no history, pain, readiness), e1RM, volume, readiness, PR, deload, generator, periodization, body-weight stats, volume bands, and store flows (rotation, history-based recommendations, PR storage, pain flag, export/restore, validation).
