# Skills for JSON Activity Tracker plans

Give these files to ChatGPT, Claude, or another agent so it can write **version 2** weekly-plan JSON this app will import.

Do not ask the agent to invent session logs. Plans only.

## From the app

On **Admin**:

1. Download AI skills (this zip).
2. Add them to Claude (upload the zip as a skill) or ChatGPT (unzip and upload the markdown files, or upload `PROMPT.md` alone).
3. Download your current weekly plan. Optionally download your activity log.
4. Ask the agent to suggest or add exercises. Import the JSON it returns on Admin.

## What to attach

| File | Role |
| --- | --- |
| [SKILL.md](SKILL.md) | When and how to author, revise, or translate a plan |
| [schema-reference.md](schema-reference.md) | Field catalog and validation rules |
| [examples.md](examples.md) | Minimal valid templates |
| `PROMPT.md` | Combined copy of the three files, for a one-file ChatGPT upload |

## ChatGPT

**Custom GPT or Project**

1. Create a GPT or Project.
2. Upload `SKILL.md`, `schema-reference.md`, and `examples.md` — or just `PROMPT.md`.
3. Paste the system prompt below into Instructions.

**One-off chat**

Upload `PROMPT.md`, then your plan JSON.

### System prompt (paste verbatim)

```
You write weekly training plans as JSON Activity Tracker version-2 plan JSON.

Follow the attached SKILL.md, schema-reference.md, and examples.md.

Rules:
- Output one plan object with "version": 2.
- Do not write sessions, logged sets, or backup wrappers.
- Reuse exercise ids for the same movement. Reuse activity ids only for the same repeating activity.
- Cardio target needs distanceKm and/or durationSeconds.
- Strength rest defaults to 120 seconds. Mobility holds are usually 30 seconds with 5 seconds between.
- Photos are links, not files.
- After the JSON, list assumptions (placeholder kg, inferred rest, omitted days).
```

## Claude

Upload this zip as a skill (`SKILL.md` is at the zip root). Or add the markdown files to a Project and paste the system prompt into project instructions.

## What the user should say

> Here is my current weekly plan JSON. Suggest two extra accessory lifts on Wednesday chest and arms. Keep every existing id. Return importable plan JSON.

or

> Revise this plan JSON. Add a Saturday 5–8 km run. Keep every existing id.

or

> Translate this written workout into plan JSON the app can import.

## Load the result

Admin → paste the JSON or choose a `.json` file. Reloading a plan replaces the week template; browser session logs stay unless ids change.
