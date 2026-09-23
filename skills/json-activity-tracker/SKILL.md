---
name: json-activity-tracker-plan
description: >-
  Authors, revises, or translates weekly training plans into version-2 JSON that
  JSON Activity Tracker can import. Use when building or editing a plan JSON,
  converting a written workout into this app's format, or when the user mentions
  JSON Activity Tracker, weekly.json, plan import, or compatible activity JSON.
---

# JSON Activity Tracker — plan JSON

Produce **one valid plan object** this app can paste or load on the Plan page.
Do not invent session logs, backups, or extra root keys.

App: **JSON Activity Tracker**. Local-first. Photos are **links**, never image files.
The week calendar runs **Sunday → Saturday**. Only days you list appear as planned.

## Workflows

Pick one:

1. **Author** — user describes a week. Build a new plan from the templates in [examples.md](examples.md).
2. **Revise** — user pastes existing JSON. Keep `id` values that still name the same day, activity, exercise, or stat. Changing an id starts a new history for that item. If they also attach an activity log, use it as history only and still return a **plan** object, not a backup wrapper.
3. **Translate** — user pastes a written workout, PDF extract, or spreadsheet. Map it into this schema. Ask only if a required field cannot be inferred.

Then:

4. Validate against [schema-reference.md](schema-reference.md).
5. Return **only** the JSON object (or a fenced `json` block). No commentary inside the JSON.

## Hard rules

- `"version": 2` is required. Older shapes fail import.
- Every `id` is a non-empty kebab-case string (`walk-3k`, `db-floor-press`).
- `weekday` is lowercase: `monday` … `sunday`. At most one day per weekday.
- Each day needs `id`, `weekday`, `name`, and at least one activity.
- Activity `kind` is exactly one of: `cardio` | `strength` | `mobility` | `progress`.
- Exercise `kind` is exactly one of: `weighted` | `bodyweight` | `timed` | `stretch`.
- **Reuse** an exercise `id` when it is the same movement later in the week. Last kg/reps follow that id.
- **Reuse** an activity `id` across days only when it is the same repeating activity (for example daily `walk-3k`).
- Day ids must be unique (`mon-back-shoulders`, `tue-mobility`).
- Times are **seconds**. Rest default for strength is **120**. Mobility holds are usually **30** with **5** seconds between.
- Cardio `target` must include `distanceKm` and/or `durationSeconds`. Min/max range alone is invalid.
- Strength and mobility need `exercises` with at least one item. Progress needs `stats` with at least one item.
- Weighted `target` needs `sets`, `reps`, `kg`. Optional `repsMin` for a range (6–8 → `repsMin: 6`, `reps: 8`).
- Bodyweight `target` needs `sets`, `reps`. No `kg`.
- Timed and stretch `target` need `sets`, `durationSeconds`. No `kg` or `reps`.
- Do not emit `sessions`, `sets` logs, `startedAt`, or backup wrappers.
- Do not add fields the schema does not list. Unknown keys are stripped and confuse humans.
- `warmup: true` is optional and unused for gating. The app offers Warm up on any weighted lift inside a strength activity.

## Mapping a written workout

| Source | JSON |
| --- | --- |
| Walk / run / row / bike | activity `kind: cardio` |
| Gym or home lifting session | activity `kind: strength` |
| Stretch / yoga / mobility flow | activity `kind: mobility`, exercises `kind: stretch` |
| Bodyweight hold (plank) | exercise `kind: timed` |
| Push-up, pull-up, sit-up | exercise `kind: bodyweight` |
| Dumbbell / barbell / kettlebell | exercise `kind: weighted` |
| Weight, waist, photos | activity `kind: progress` |
| “3 × 6–8 @ 12 kg” | `sets: 3`, `repsMin: 6`, `reps: 8`, `kg: 12` |
| “alternate A and B, then rest” | same `supersetId` on both exercises |
| “2 min rest” | `restSeconds: 120` on the activity or exercise |

If equipment is unknown, use a modest placeholder `kg` and say so in `notes`.

## Output

1. Valid JSON. 2-space indent. No trailing commas. No comments.
2. Include `name`, `id`, optional `notes`, optional `notificationTime` (`HH:MM` 24-hour, default `07:00`).
3. After the JSON, a short checklist of assumptions (placeholder weights, inferred rest, days omitted).

## Additional resources

- Field catalog: [schema-reference.md](schema-reference.md)
- Copy-paste templates: [examples.md](examples.md)
