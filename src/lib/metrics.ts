import type { Activity, Exercise, LoggedSet, Plan, PlanDay, Session } from './schema';
import { setCount } from './schema';
import { formatDuration, formatKg, formatNumber } from './format';

export interface DayMetrics {
	dayId: string;
	setsCompleted: number;
	setsPlanned: number;
	volumeKg: number;
	cardioSeconds: number;
	cardioKm: number;
	sessionSeconds: number | null;
}

export function sessionSeconds(session: Session | undefined): number | null {
	if (!session?.startedAt) return null;
	const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
	const start = Date.parse(session.startedAt);
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
	return Math.round((end - start) / 1000);
}

export function volumeForSet(set: LoggedSet): number {
	if (!set.completed) return 0;
	const kg = set.kg ?? 0;
	const reps = set.reps ?? 0;
	return kg * reps;
}

export function metricsForDay(day: PlanDay, sessions: Session[]): DayMetrics {
	const planned = day.activities
		.filter((activity) => activity.kind === 'strength' || activity.kind === 'mobility')
		.reduce(
			(sum, activity) =>
				sum + activity.exercises.reduce((inner, exercise) => inner + setCount(exercise), 0),
			0
		);
	const completed = sessions.flatMap((session) => session.sets.filter((set) => set.completed));
	const cardio = sessions.filter((session) => session.kind === 'cardio');
	const durations = sessions
		.map((session) => sessionSeconds(session))
		.filter((value): value is number => value != null);

	return {
		dayId: day.id,
		setsCompleted: completed.length,
		setsPlanned: planned,
		volumeKg: completed.reduce((sum, set) => sum + volumeForSet(set), 0),
		cardioSeconds: cardio.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0),
		cardioKm: cardio.reduce((sum, session) => sum + (session.distanceKm ?? 0), 0),
		sessionSeconds: durations.length ? durations.reduce((sum, value) => sum + value, 0) : null
	};
}

export function sumMetrics(days: DayMetrics[]): Omit<DayMetrics, 'dayId'> {
	return days.reduce(
		(acc, day) => ({
			setsCompleted: acc.setsCompleted + day.setsCompleted,
			setsPlanned: acc.setsPlanned + day.setsPlanned,
			volumeKg: acc.volumeKg + day.volumeKg,
			cardioSeconds: acc.cardioSeconds + day.cardioSeconds,
			cardioKm: acc.cardioKm + day.cardioKm,
			sessionSeconds: (acc.sessionSeconds ?? 0) + (day.sessionSeconds ?? 0)
		}),
		{
			setsCompleted: 0,
			setsPlanned: 0,
			volumeKg: 0,
			cardioSeconds: 0,
			cardioKm: 0,
			sessionSeconds: 0
		}
	);
}

export function deltaText(current: number, previous: number, formatter: (value: number) => string) {
	const delta = current - previous;
	if (delta === 0) return 'same';
	const sign = delta > 0 ? '+' : '−';
	return `${sign}${formatter(Math.abs(delta))}`;
}

function repsPreview(reps: number, repsMin?: number): string {
	return repsMin != null && repsMin !== reps ? `${repsMin}–${reps}` : String(reps);
}

export function targetPreview(exercise: Exercise): string {
	switch (exercise.kind) {
		case 'weighted':
			return `${exercise.target.sets} × ${repsPreview(exercise.target.reps, exercise.target.repsMin)} @ ${formatKg(exercise.target.kg)} kg`;
		case 'bodyweight':
			return `${exercise.target.sets} × ${repsPreview(exercise.target.reps, exercise.target.repsMin)}`;
		case 'timed':
		case 'stretch':
			return `${exercise.target.sets} × ${formatDuration(exercise.target.durationSeconds)}`;
	}
}

export function activityPreview(activity: Activity): string {
	if (activity.kind === 'cardio') {
		const target = activity.target;
		if (target.distanceKmMin != null && target.distanceKmMax != null) {
			return `${formatNumber(target.distanceKmMin)}–${formatNumber(target.distanceKmMax)} km`;
		}
		if (target.distanceKm) return `${formatNumber(target.distanceKm)} km`;
		if (target.durationSeconds) return formatDuration(target.durationSeconds);
		return 'Cardio';
	}
	if (activity.kind === 'strength' || activity.kind === 'mobility') {
		const count = activity.exercises.length;
		return `${count} ${count === 1 ? 'exercise' : 'exercises'}`;
	}
	return activity.stats.map((stat) => stat.name).join(', ');
}

export function planHasDay(plan: Plan, dayId: string): PlanDay | undefined {
	return plan.days.find((day) => day.id === dayId);
}
