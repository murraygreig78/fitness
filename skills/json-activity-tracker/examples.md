# Plan templates

Copy the smallest template that fits, then expand. All of these are version-2 valid.

## Minimal strength day

```json
{
  "version": 2,
  "id": "two-lift-week",
  "name": "Two-lift week",
  "notificationTime": "07:00",
  "days": [
    {
      "id": "mon-strength",
      "weekday": "monday",
      "name": "Upper body",
      "estimatedMinutes": 40,
      "activities": [
        {
          "id": "upper-strength",
          "name": "Upper body",
          "kind": "strength",
          "restSeconds": 120,
          "exercises": [
            {
              "id": "db-floor-press",
              "name": "Dumbbell floor press",
              "kind": "weighted",
              "primaryMuscles": ["chest", "triceps"],
              "instructions": "Upper arms touch the floor, then press. Keep ribs down.",
              "target": { "sets": 3, "reps": 8, "repsMin": 6, "kg": 12 }
            },
            {
              "id": "push-up",
              "name": "Push-up",
              "kind": "bodyweight",
              "primaryMuscles": ["chest", "triceps"],
              "target": { "sets": 3, "reps": 8, "repsMin": 6 }
            }
          ]
        }
      ]
    }
  ]
}
```

## Cardio with a distance range

`distanceKm` is required even when min/max are set.

```json
{
  "id": "long-run",
  "name": "Long run",
  "kind": "cardio",
  "instructions": "5–8 km. Log the distance you ran and the time it took.",
  "target": {
    "distanceKm": 6,
    "distanceKmMin": 5,
    "distanceKmMax": 8
  }
}
```

Walk with only distance:

```json
{
  "id": "walk-3k",
  "name": "3km walk",
  "kind": "cardio",
  "target": { "distanceKm": 3 }
}
```

## Mobility stretches (auto timer)

```json
{
  "id": "tue-mobility-flow",
  "name": "Mobility stretching",
  "kind": "mobility",
  "instructions": "30-second holds. Move slowly into each position.",
  "exercises": [
    {
      "id": "hip-flexor",
      "name": "Hip flexor stretch",
      "kind": "stretch",
      "primaryMuscles": ["hips"],
      "restSeconds": 5,
      "target": { "sets": 1, "durationSeconds": 30 }
    },
    {
      "id": "hamstring-fold",
      "name": "Seated hamstring fold",
      "kind": "stretch",
      "primaryMuscles": ["hamstrings"],
      "restSeconds": 5,
      "target": { "sets": 1, "durationSeconds": 30 }
    }
  ]
}
```

## Superset

Same `supersetId`. Rest after the pair, not between the two.

```json
{
  "id": "lying-leg-raise",
  "name": "Lying leg raise",
  "kind": "bodyweight",
  "supersetId": "abs-plank",
  "restSeconds": 0,
  "target": { "sets": 3, "reps": 8, "repsMin": 6 }
}
```

```json
{
  "id": "front-plank",
  "name": "Front plank",
  "kind": "timed",
  "supersetId": "abs-plank",
  "restSeconds": 120,
  "target": { "sets": 3, "durationSeconds": 30 }
}
```

## Progress / body stats

```json
{
  "id": "body-stats",
  "name": "Body stats",
  "kind": "progress",
  "allowPhoto": true,
  "instructions": "Store photos as a link. The browser does not keep the image file.",
  "stats": [
    { "id": "weight", "name": "Weight", "unit": "kg" },
    { "id": "waist", "name": "Waist", "unit": "cm" }
  ]
}
```

## One day, two activities

```json
{
  "id": "wed-chest-arms",
  "weekday": "wednesday",
  "name": "Walk and strength",
  "estimatedMinutes": 50,
  "activities": [
    {
      "id": "walk-3k",
      "name": "3km walk",
      "kind": "cardio",
      "target": { "distanceKm": 3 }
    },
    {
      "id": "chest-arms",
      "name": "Chest and arms",
      "kind": "strength",
      "restSeconds": 120,
      "exercises": [
        {
          "id": "db-floor-press",
          "name": "Dumbbell floor press",
          "kind": "weighted",
          "primaryMuscles": ["chest", "triceps"],
          "target": { "sets": 3, "reps": 8, "repsMin": 6, "kg": 12 }
        }
      ]
    }
  ]
}
```

## Reuse ids

- Daily walk: repeat the `walk-3k` activity object (same `id`) on each day that includes it.
- Same lift on Friday as Monday: same exercise `id` (`db-floor-press`) so last kg/reps carry over.

## Do not output

```json
{
  "version": 2,
  "exportedAt": "…",
  "plan": {},
  "sessions": []
}
```

That is a log backup, not a weekly plan.
