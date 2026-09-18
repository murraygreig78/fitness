# Fitness

A local-first weekly training log. Import a JSON plan, record sets on your phone, and compare this week with the last one. There is no server and no account: the plan lives in git, and session history stays in the browser.

The bundled programme is the current home week:

- Every day: 3km walk (log distance and time)
- Monday: back and shoulders
- Tuesday / Thursday: mobility stretching (30s holds)
- Wednesday: chest and arms
- Friday: legs and abs, with a lying-leg-raise / front-plank superset
- Saturday: 5–8km run (log distance and time)
- Sunday: walk only

Strength work is 3 × 6–8. Dumbbell kg starts at 12 as a placeholder — change it once, then use **Prev** on the keypad.

## Daily use

1. Open **Plan** and load the sample week (or paste your own JSON).
2. Train from **Week**. Tap a day, then tap kg / reps / time / distance to log with the number pad.
3. Use **Prev** on the keypad to fill the last logged value for that set.
4. Open **Compare** to see volume, sets, cardio, and session time against the previous week.

The same weekly template repeats every Monday. Changing the JSON and re-importing updates the template; old logs stay in IndexedDB.

## Plan files

Canonical example: [`plans/weekly.json`](plans/weekly.json). The same file is served from [`static/plans/weekly.json`](static/plans/weekly.json) so the app can load it in the browser.

A plan is a repeating week of days. Each exercise has a `kind`:

- `weighted` — sets, reps (`repsMin`–`reps` for a range), kg, rest
- `bodyweight` — sets, reps, rest
- `timed` / `stretch` — sets, duration in seconds, rest
- `cardio` — distance and/or duration; log time even when the target is distance

Use `supersetId` on two or more exercises to alternate them. Rest on the last exercise in the pair (Friday abs uses 2 minutes).

## Logs

Sessions are stored in IndexedDB. Export a JSON backup from **Plan** if you change browsers. Do not commit log backups.

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

## Deploy (Cloudflare Pages)

Zero server cost. Connect the GitHub repo to Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `build`
- Node version: `22` or later

[`static/_redirects`](static/_redirects) sends unknown routes to `index.html` so `/session/...` works as a static SPA. The build also writes `404.html` as an SPA fallback for GitHub Pages.

## Stack

SvelteKit (static), TypeScript, Tailwind CSS, Zod, Dexie.
