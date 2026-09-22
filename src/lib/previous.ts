import type { Activity, ActivityKind, Exercise, LoggedSet, Session } from './schema';
import { hasProgressData } from './schema';

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
	setIndex: number,
	warmup = false
): LoggedSet | undefined {
	return sets.find(
		(set) =>
			set.exerciseId === exerciseId && set.setIndex === setIndex && Boolean(set.warmup) === warmup
	);
}

export function previousSetValue(
	sessionsNewestFirst: Session[],
	exerciseId: string,
	setIndex: number,
	field: LogField,
	warmup = false
): number | undefined {
	for (const session of sessionsNewestFirst) {
		const match = findSet(session.sets, exerciseId, setIndex, warmup);
		const value = match ? setFieldValue(match, field) : undefined;
		if (value != null) return value;
	}
	return undefined;
}

export function lastUsedFieldValue(
	currentSets: LoggedSet[],
	previousSessions: Session[],
	exerciseId: string,
	setIndex: number,
	field: LogField,
	warmup = false
): number | undefined {
	const fromThisSet = previousSetValue(previousSessions, exerciseId, setIndex, field, warmup);
	if (fromThisSet != null) return fromThisSet;
	if (setIndex > 0) {
		const fromPriorSet = previousSetValue(
			previousSessions,
			exerciseId,
			setIndex - 1,
			field,
			warmup
		);
		if (fromPriorSet != null) return fromPriorSet;
	}
	const earlier = currentSets
		.filter(
			(set) =>
				set.exerciseId === exerciseId && set.setIndex < setIndex && Boolean(set.warmup) === warmup
		)
		.sort((a, b) => b.setIndex - a.setIndex);
	for (const set of earlier) {
		const value = setFieldValue(set, field);
		if (value != null) return value;
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
			return isEarlierSession(session, weekStart, dayId, weekdayIndex, dayIndexById);
		})
		.sort(sortSessionsNewestFirst(dayIndexById));
}

export function previousSessionsForKind(
	all: Session[],
	planId: string,
	kind: ActivityKind,
	weekStart: string,
	dayId: string,
	weekdayIndex = 0,
	dayIndexById: Record<string, number> = {}
): Session[] {
	return all
		.filter((session) => {
			if (session.planId !== planId || session.kind !== kind || session.skipped) return false;
			return isEarlierSession(session, weekStart, dayId, weekdayIndex, dayIndexById);
		})
		.sort(sortSessionsNewestFirst(dayIndexById));
}

export function lastCompletedSession(sessionsNewestFirst: Session[]): Session | undefined {
	return sessionsNewestFirst.find(
		(session) =>
			!session.skipped &&
			(session.completed ||
				session.endedAt ||
				session.sets.some((set) => set.completed) ||
				hasProgressData(session))
	);
}

export function previousStatValue(
	sessionsNewestFirst: Session[],
	statId: string,
	unit?: string
): number | undefined {
	for (const session of sessionsNewestFirst) {
		const match =
			session.stats.find((stat) => stat.statId === statId && stat.value != null) ??
			(unit ? session.stats.find((stat) => stat.unit === unit && stat.value != null) : undefined);
		if (match?.value != null) return match.value;
	}
	return undefined;
}

function isEarlierSession(
	session: Session,
	weekStart: string,
	dayId: string,
	weekdayIndex: number,
	dayIndexById: Record<string, number>
): boolean {
	if (session.weekStart < weekStart) return true;
	if (session.weekStart !== weekStart || session.dayId === dayId) return false;
	const otherIndex = dayIndexById[session.dayId];
	return otherIndex != null && otherIndex < weekdayIndex;
}

function sortSessionsNewestFirst(dayIndexById: Record<string, number>) {
	return (a: Session, b: Session) => {
		const week = b.weekStart.localeCompare(a.weekStart);
		if (week !== 0) return week;
		return (dayIndexById[b.dayId] ?? 0) - (dayIndexById[a.dayId] ?? 0);
	};
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
