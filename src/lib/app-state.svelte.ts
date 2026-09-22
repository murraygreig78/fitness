import { browser } from '$app/environment';
import { db, type StoredCustomActivity } from './db';
import {
	createSession,
	dayIdForWeekday,
	mergeLoggedSets,
	parseLogsBackup,
	parsePlanJson,
	type Activity,
	type Exercise,
	type LogsBackup,
	type Plan,
	type PlanDay,
	type Session,
	type Weekday
} from './schema';
import { sundayOf } from './week';

function asPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

class FitnessApp {
	plan = $state<Plan | null>(null);
	sessions = $state<Session[]>([]);
	customActivities = $state<StoredCustomActivity[]>([]);
	ready = $state(false);
	error = $state<string | null>(null);
	weekStart = $state(sundayOf());

	sessionMap = $derived.by(() => {
		const map = new Map<string, Session>();
		for (const session of this.sessions) {
			map.set(session.id, session);
		}
		return map;
	});

	async init() {
		if (!browser) return;
		try {
			const [meta, plans, sessions, customActivities] = await Promise.all([
				db.meta.get('app'),
				db.plans.toArray(),
				db.sessions.toArray(),
				db.customActivities.toArray()
			]);
			const activeId = meta?.activePlanId;
			const stored = activeId ? plans.find((item) => item.id === activeId) : plans[0];
			this.plan = stored?.plan ?? null;
			this.sessions = sessions;
			this.customActivities = customActivities;
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Could not open local data';
		} finally {
			this.ready = true;
		}
	}

	sessionFor(dayId: string, activityId: string, weekStart = this.weekStart): Session | undefined {
		return this.sessionMap.get(`${weekStart}::${dayId}::${activityId}`);
	}

	sessionsForDay(dayId: string, weekStart = this.weekStart): Session[] {
		return this.sessions.filter(
			(session) => session.dayId === dayId && session.weekStart === weekStart
		);
	}

	customActivitiesForDay(dayId: string, weekStart = this.weekStart): Activity[] {
		return this.customActivities
			.filter((item) => item.dayId === dayId && item.weekStart === weekStart)
			.map((item) => item.activity);
	}

	customActivity(activityId: string, weekStart = this.weekStart): StoredCustomActivity | undefined {
		return this.customActivities.find(
			(item) => item.id === activityId && item.weekStart === weekStart
		);
	}

	activitiesForWeekday(weekday: Weekday, weekStart = this.weekStart): Activity[] {
		const planned = this.plan?.days.find((day) => day.weekday === weekday)?.activities ?? [];
		const dayId = dayIdForWeekday(this.plan, weekday);
		return [...planned, ...this.customActivitiesForDay(dayId, weekStart)];
	}

	progressSessions(): Session[] {
		return this.sessions
			.filter((session) => session.kind === 'progress' && !session.skipped)
			.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.id.localeCompare(a.id));
	}

	async importPlan(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
		const result = parsePlanJson(input);
		if ('error' in result) return { ok: false, error: result.error };
		return this.persistPlan(result.plan);
	}

	async persistPlan(plan: Plan): Promise<{ ok: true } | { ok: false; error: string }> {
		const result = parsePlanJson(asPlain(plan));
		if ('error' in result) return { ok: false, error: result.error };
		const next = result.plan;
		const existing = await db.plans.get(next.id);
		await db.plans.put({
			id: next.id,
			plan: next,
			importedAt: existing?.importedAt ?? new Date().toISOString()
		});
		await db.meta.put({ id: 'app', activePlanId: next.id });
		this.plan = next;
		this.error = null;
		return { ok: true };
	}

	async updateExercise(
		activityId: string,
		exercise: Exercise
	): Promise<{ ok: true } | { ok: false; error: string }> {
		const custom = this.customActivities.find((item) => item.activity.id === activityId);
		if (custom) {
			const activity = custom.activity;
			if (activity.kind !== 'strength' && activity.kind !== 'mobility') {
				return { ok: false, error: 'That activity has no exercises' };
			}
			const nextActivity = {
				...activity,
				exercises: activity.exercises.map((item) => (item.id === exercise.id ? exercise : item))
			};
			const record = { ...custom, activity: nextActivity };
			await db.customActivities.put(asPlain(record));
			this.customActivities = [
				...this.customActivities.filter((item) => item.id !== record.id),
				record
			];
			return { ok: true };
		}
		if (!this.plan) return { ok: false, error: 'Import a plan first' };
		let found = false;
		const plan: Plan = {
			...this.plan,
			days: this.plan.days.map((day) => ({
				...day,
				activities: day.activities.map((activity) => {
					if (activity.id !== activityId) return activity;
					if (activity.kind !== 'strength' && activity.kind !== 'mobility') return activity;
					found = activity.exercises.some((item) => item.id === exercise.id);
					return {
						...activity,
						exercises: activity.exercises.map((item) => (item.id === exercise.id ? exercise : item))
					};
				})
			}))
		};
		if (!found) return { ok: false, error: 'That exercise is not in the weekly plan' };
		return this.persistPlan(plan);
	}

	async addCustomActivity(
		weekday: Weekday,
		activity: Activity,
		weekStart = this.weekStart
	): Promise<StoredCustomActivity> {
		if (!this.plan) {
			throw new Error('Import a plan before logging an activity');
		}
		const record: StoredCustomActivity = {
			id: activity.id,
			weekStart,
			dayId: dayIdForWeekday(this.plan, weekday),
			weekday,
			planId: this.plan.id,
			activity
		};
		await db.customActivities.put(record);
		this.customActivities = [
			...this.customActivities.filter((item) => item.id !== record.id),
			record
		];
		return record;
	}

	async ensureSession(
		day: PlanDay,
		activity: Activity,
		weekStart = this.weekStart
	): Promise<Session> {
		if (!this.plan) {
			throw new Error('Import a plan before logging an activity');
		}
		const existing = this.sessionFor(day.id, activity.id, weekStart);
		if (existing) return existing;
		const session = createSession(this.plan, day, activity, weekStart);
		await this.saveSession(session);
		return session;
	}

	async saveSession(session: Session) {
		const current = this.sessionMap.get(session.id);
		const toSave = asPlain(
			current
				? { ...current, ...session, sets: mergeLoggedSets(current.sets, session.sets) }
				: session
		);
		await db.sessions.put(toSave);
		this.sessions = [...this.sessions.filter((item) => item.id !== toSave.id), toSave];
	}

	exportBackup(): LogsBackup {
		return {
			version: 2,
			exportedAt: new Date().toISOString(),
			plan: this.plan,
			sessions: this.sessions
		};
	}

	async importBackup(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
		const result = parseLogsBackup(input);
		if ('error' in result) return { ok: false, error: result.error };
		const { backup } = result;
		await db.transaction('rw', db.plans, db.sessions, db.meta, async () => {
			await db.sessions.clear();
			if (backup.plan) {
				await db.plans.put({
					id: backup.plan.id,
					plan: backup.plan,
					importedAt: backup.exportedAt
				});
				await db.meta.put({ id: 'app', activePlanId: backup.plan.id });
			}
			if (backup.sessions.length) {
				await db.sessions.bulkPut(backup.sessions);
			}
		});
		this.plan = backup.plan;
		this.sessions = backup.sessions;
		return { ok: true };
	}
}

export const fitness = new FitnessApp();
