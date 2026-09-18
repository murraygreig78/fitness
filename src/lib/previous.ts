import type { Exercise, LoggedSet, Session } from './schema';

export type LogField = 'kg' | 'reps' | 'durationSeconds' | 'distanceKm';

export function targetFieldValue(exercise: Exercise, field: LogField): number | undefined {
	const target = exercise.target;
	if (field === 'kg' && 'kg' in target) return target.kg;
	if (field === 'reps' && 'reps' in target) return target.reps;
	if (field === 'durationSeconds' && 'durationSeconds' in target) return target.durationSeconds;
	if (field === 'distanceKm' && 'distanceKm' in target) {
		return target.distanceKm ?? target.distanceKmMin;
	}
	return undefined;
}

export function fieldsForExercise(exercise: Exercise): LogField[] {
	switch (exercise.kind) {
		case 'weighted':
			return ['kg', 'reps'];
		case 'bodyweight':
			return ['reps'];
		case 'timed':
		case 'stretch':
			return ['durationSeconds'];
		case 'cardio': {
			const fields: LogField[] = [];
			if (
				exercise.target.distanceKm != null ||
				exercise.target.distanceKmMin != null ||
				exercise.target.distanceKmMax != null
			) {
				fields.push('distanceKm');
			}
			fields.push('durationSeconds');
			return fields;
		}
	}
}

export function findSet(
	sets: LoggedSet[],
	exerciseId: string,
	setIndex: number
): LoggedSet | undefined {
	return sets.find((set) => set.exerciseId === exerciseId && set.setIndex === setIndex);
}

export function previousSetValue(
	sessionsNewestFirst: Session[],
	exerciseId: string,
	setIndex: number,
	field: LogField
): number | undefined {
	for (const session of sessionsNewestFirst) {
		const match = findSet(session.sets, exerciseId, setIndex);
		if (match?.completed && match[field] != null) {
			return match[field];
		}
	}
	return undefined;
}

export function previousSessionsFor(
	all: Session[],
	planId: string,
	dayId: string,
	weekStart: string,
	weekdayIndex = 0,
	dayIndexById: Record<string, number> = {}
): Session[] {
	return all
		.filter((session) => {
			if (session.planId !== planId) return false;
			if (session.weekStart < weekStart) return true;
			if (session.weekStart !== weekStart || session.dayId === dayId) return false;
			const otherIndex = dayIndexById[session.dayId];
			return otherIndex != null && otherIndex < weekdayIndex;
		})
		.sort((a, b) => {
			const week = b.weekStart.localeCompare(a.weekStart);
			if (week !== 0) return week;
			return (dayIndexById[b.dayId] ?? 0) - (dayIndexById[a.dayId] ?? 0);
		});
}

export function stepForField(field: LogField): number {
	switch (field) {
		case 'kg':
			return 2.5;
		case 'reps':
			return 1;
		case 'durationSeconds':
			return 15;
		case 'distanceKm':
			return 0.1;
	}
}

export function fieldLabel(field: LogField): string {
	switch (field) {
		case 'kg':
			return 'kg';
		case 'reps':
			return 'reps';
		case 'durationSeconds':
			return 'time';
		case 'distanceKm':
			return 'km';
	}
}

export function durationUsesMinutes(exercise: Exercise): boolean {
	return exercise.kind === 'cardio';
}
