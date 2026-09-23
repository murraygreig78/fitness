# Plan schema (version 2)

Source of truth: `src/lib/schema.ts` (`planSchema`). Import uses `parsePlanJson`.

## Plan

```
{
  version: 2,                    // required literal
  id: string,                    // kebab-case, stable
  name: string,
  notes?: string,
  notificationTime?: "HH:MM",    // 24-hour, 00:00–23:59. Default 07:00
  days: PlanDay[]                // min 1
}
```

## Day

```
{
  id: string,                    // unique in the plan
  weekday: "monday" | "tuesday" | "wednesday" | "thursday"
         | "friday" | "saturday" | "sunday",
  name: string,
  estimatedMinutes?: number,     // positive
  activities: Activity[]         // min 1
}
```

Omit rest days. The app week still shows Sunday–Saturday.

## Activity (discriminated by `kind`)

Shared: `id`, `name`, `instructions?`, `notes?`, `videoUrl?`.

### `cardio`

```
{
  kind: "cardio",
  target: {
    distanceKm?: number,         // positive. Required unless durationSeconds is set
    durationSeconds?: number,    // positive. Required unless distanceKm is set
    distanceKmMin?: number,      // optional range; still need distanceKm or durationSeconds
    distanceKmMax?: number
  }
}
```

Invalid: only `distanceKmMin` / `distanceKmMax`.

### `strength`

```
{
  kind: "strength",
  restSeconds?: number,          // default 120. Exercise restSeconds overrides
  exercises: Exercise[]          // min 1
}
```

Warm up is offered in the app for every `weighted` exercise here. No JSON flag required.

### `mobility`

```
{
  kind: "mobility",
  exercises: Exercise[]          // min 1, usually kind: stretch
}
```

Auto timer uses each stretch `target.durationSeconds` as the hold and `restSeconds` as the gap. Typical: hold `30`, gap `5`.

### `progress`

```
{
  kind: "progress",
  allowPhoto?: boolean,          // default true. Photo is a URL or path, not a file
  stats: { id, name, unit }[]    // min 1. unit examples: kg, cm
}
```

## Exercise (discriminated by `kind`)

Shared:

```
{
  id: string,
  name: string,
  primaryMuscles?: string[],     // default []
  videoUrl?: string,
  instructions?: string,
  notes?: string,
  restSeconds?: number,          // nonnegative. Strength default comes from the activity
  supersetId?: string,           // same id on partners; rest after the pair
  warmup?: boolean               // default false; ignored for showing the Warm up button
}
```

Targets:

| kind | target |
| --- | --- |
| `weighted` | `{ sets, reps, kg, repsMin? }` |
| `bodyweight` | `{ sets, reps, repsMin? }` |
| `timed` | `{ sets, durationSeconds }` |
| `stretch` | `{ sets, durationSeconds }` |

- `sets`: positive integer
- `reps`, `repsMin`, `durationSeconds`: positive numbers
- `kg`: nonnegative number
- Range 6–8: `repsMin: 6`, `reps: 8`

## Rest

1. Exercise `restSeconds` if set
2. Else strength activity `restSeconds` (default 120)
3. Else 0 (mobility / cardio / progress)
4. Warm-up rest in the app is half of the working rest

## Ids and history

Sessions key off `planId`, `dayId`, `activityId`. Logged sets key off `exerciseId`. Stats key off `statId`.

- Same movement later in the week → **same exercise id**
- Same daily walk → **same activity id** is fine
- Renaming a person-facing `name` is safe; changing `id` is not

## Not part of a plan file

Do not write these when authoring a week:

- `sessions`, `sets` (logged), `stats` values, `startedAt`, `endedAt`, `completed`, `skipped`
- Backup wrapper `{ version, exportedAt, plan, sessions }`

Those are log exports from Plan, not importable weekly templates.

## Import

1. Plan page → paste JSON or choose a `.json` file
2. Or load a file from `plans/` / `static/plans/`
3. Reloading a plan replaces the week JSON. Session logs in the browser stay unless ids change
