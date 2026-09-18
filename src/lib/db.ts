import Dexie, { type Table } from 'dexie';
import type { Plan, Session } from './schema';

export interface StoredPlan {
	id: string;
	plan: Plan;
	importedAt: string;
}

export interface AppMeta {
	id: 'app';
	activePlanId: string | null;
}

class FitnessDB extends Dexie {
	plans!: Table<StoredPlan, string>;
	sessions!: Table<Session, string>;
	meta!: Table<AppMeta, string>;

	constructor() {
		super('fitness-local');
		this.version(1).stores({
			plans: 'id',
			sessions: 'id, weekStart, dayId, planId',
			meta: 'id'
		});
	}
}

export const db = new FitnessDB();
