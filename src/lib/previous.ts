import type { Activity, Exercise, LoggedSet, Session } from './schema';

export type ExerciseField = 'kg' | 'reps' | 'durationSeconds';
export type LogField = ExerciseField | 'distanceKm';

export function setFieldValue(set: LoggedSet, field: LogField): number | undefined {
	if (field === 'distanceKm') return undefined;
	return set[field];
}

export function targetFieldValue(exercise: Exercise, field: LogField): number | undefined {
	const target = exercise.target;
	if (field === 'kg' && 'kg' in target) return target.kg;
	if (field === 'reps' && 'reps' in target) return target.reps;
	if (field === 'durationSeconds' && 'durationSeconds' in target) return target.durationSeconds;
	return undefined;
}

export function cardioTargetValue(activity: Activity, field: 'distanceKm' | 'durationSeconds') {
	if (activity.kind !== 'cardio') return undefined;
	if (field === 'durationSeconds') return activity.target.durationSeconds;
	return activity.target.distanceKm ?? activity.target.distanceKmMin;
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
		if (match?.completed) {
			const value = setFieldValue(match, field);
			if (value != null) return value;
		}
	}
	return undefined;
}

export function previousCardioValue(
	sessionsNewestFirst: Session[],
	field: 'distanceKm' | 'durationSeconds'
): number | undefined {
	for (const session of sessionsNewestFirst) {
		if (session[field] != null) return session[field];
	}
	return undefined;
}

export function previousSessionsFor(
	all: Session[],
	planId: string,
	activityId: string,
	weekStart: string,
	dayId: string,
	weekdayIndex = 0,
	dayIndexById: Record<string, number> = {}
): Session[] {
	return all
		.filter((session) => {
			if (session.planId !== planId || session.activityId !== activityId) return false;
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

export function durationUsesMinutes(kind: 'cardio' | Exercise['kind']): boolean {
	return kind === 'cardio';
}
