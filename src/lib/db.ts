import Dexie, { type Table } from 'dexie';
import type { Activity, Plan, Session, Weekday } from './schema';

export interface StoredPlan {
	id: string;
	plan: Plan;
	importedAt: string;
}

export interface AppMeta {
	id: 'app';
	activePlanId: string | null;
}

export interface StoredCustomActivity {
	id: string;
	weekStart: string;
	dayId: string;
	weekday: Weekday;
	planId: string;
	activity: Activity;
}

class FitnessDB extends Dexie {
	plans!: Table<StoredPlan, string>;
	sessions!: Table<Session, string>;
	meta!: Table<AppMeta, string>;
	customActivities!: Table<StoredCustomActivity, string>;

	constructor() {
		super('fitness-local-v2');
		this.version(1).stores({
			plans: 'id',
			sessions: 'id, weekStart, dayId, activityId, planId, kind',
			meta: 'id'
		});
		this.version(2).stores({
			plans: 'id',
			sessions: 'id, weekStart, dayId, activityId, planId, kind',
			meta: 'id',
			customActivities: 'id, weekStart, dayId'
		});
	}
}

export const db = new FitnessDB();
