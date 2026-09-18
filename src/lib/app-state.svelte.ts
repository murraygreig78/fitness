import { browser } from '$app/environment';
import { db } from './db';
import {
	createSession,
	parseLogsBackup,
	parsePlanJson,
	type LogsBackup,
	type Plan,
	type PlanDay,
	type Session
} from './schema';
import { mondayOf } from './week';

class FitnessApp {
	plan = $state<Plan | null>(null);
	sessions = $state<Session[]>([]);
	ready = $state(false);
	error = $state<string | null>(null);
	weekStart = $state(mondayOf());

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
			const [meta, plans, sessions] = await Promise.all([
				db.meta.get('app'),
				db.plans.toArray(),
				db.sessions.toArray()
			]);
			const activeId = meta?.activePlanId;
			const stored = activeId ? plans.find((item) => item.id === activeId) : plans[0];
			this.plan = stored?.plan ?? null;
			this.sessions = sessions;
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Could not open local data';
		} finally {
			this.ready = true;
		}
	}

	sessionFor(dayId: string, weekStart = this.weekStart): Session | undefined {
		return this.sessionMap.get(`${weekStart}::${dayId}`);
	}

	async importPlan(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
		const result = parsePlanJson(input);
		if ('error' in result) return { ok: false, error: result.error };
		const plan = result.plan;
		await db.plans.put({
			id: plan.id,
			plan,
			importedAt: new Date().toISOString()
		});
		await db.meta.put({ id: 'app', activePlanId: plan.id });
		this.plan = plan;
		this.error = null;
		return { ok: true };
	}

	async ensureSession(day: PlanDay, weekStart = this.weekStart): Promise<Session> {
		if (!this.plan) {
			throw new Error('Import a plan before logging a session');
		}
		const existing = this.sessionFor(day.id, weekStart);
		if (existing) return existing;
		const session = createSession(this.plan, day, weekStart);
		await this.saveSession(session);
		return session;
	}

	async saveSession(session: Session) {
		await db.sessions.put(session);
		this.sessions = [...this.sessions.filter((item) => item.id !== session.id), session];
	}

	async patchSession(sessionId: string, patch: (current: Session) => Session) {
		const current = this.sessionMap.get(sessionId);
		if (!current) return;
		await this.saveSession(patch(structuredClone(current)));
	}

	exportBackup(): LogsBackup {
		return {
			version: 1,
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
