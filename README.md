# Fitness

A local-first weekly training log. Import a JSON plan, record activities on your phone, and compare this week with the last one. There is no server and no account: the plan lives in git, and session history stays in the browser.

A **day** is a list of **activities**. Activity kinds:

- `cardio` — walk, run, row. Measured by distance and time.
- `strength` — a session that contains nested **exercises** (sets, reps, kg).
- `mobility` — a stretching session of nested exercises (timed holds).
- `progress` — body stats over time (weight, height, waist, and a photo **link**, not the image file).

The bundled week:

- Every day: 3km walk (cardio)
- Monday / Wednesday / Friday: strength
- Tuesday / Thursday: mobility
- Saturday: long run (second cardio)
- Sunday: body stats (progress)

Monday’s week card therefore reads **2 activities · cardio, strength**.

## Daily use

1. Open **Plan** and load the sample week (version 2 JSON).
2. From **Week**, open a day, then open an activity to log it.
3. Use **Prev** on the keypad to fill the last logged value.
4. **Compare** weeks. **Progress** lists body stats over time.

## Plan files

Canonical example: [`plans/weekly.json`](plans/weekly.json) (`version: 2`). Strength and mobility nest `exercises`. Cardio has a `target` with distance/time. Progress lists `stats` with units.

## Logs

Sessions are stored in IndexedDB, one per activity. Export a JSON backup from **Plan** if you change browsers. Do not commit log backups. Re-import the sample week after this schema change.

## Develop

```sh
npm install
npm run dev
```

```sh
npm run check
npm run build
npm run preview
```

## Deploy (GitHub Pages)

The site is https://murraygreig78.github.io/fitness/. CI builds with `BASE_PATH=/fitness` so the app lives under that path.

1. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Merge to `main` (or run the **Deploy GitHub Pages** workflow).
3. Open the live URL and tap **Plan → Load sample week**. Logs are per origin, so this is a fresh browser store.

Local `npm run dev` still serves from `/`.

## Stack

SvelteKit (static), TypeScript, Tailwind CSS, Zod, Dexie.
