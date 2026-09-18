import type { Exercise, LoggedSet, Plan, PlanDay, Session } from './schema';
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

export function metricsForDay(
	day: PlanDay,
	session: Session | undefined
): DayMetrics {
	const planned = day.exercises.reduce((sum, exercise) => sum + setCount(exercise), 0);
	const sets = session?.sets ?? [];
	const completed = sets.filter((set) => set.completed);
	const cardioIds = new Set(
		day.exercises.filter((exercise) => exercise.kind === 'cardio').map((exercise) => exercise.id)
	);

	return {
		dayId: day.id,
		setsCompleted: completed.length,
		setsPlanned: planned,
		volumeKg: completed.reduce((sum, set) => sum + volumeForSet(set), 0),
		cardioSeconds: completed
			.filter((set) => cardioIds.has(set.exerciseId))
			.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0),
		cardioKm: completed
			.filter((set) => cardioIds.has(set.exerciseId))
			.reduce((sum, set) => sum + (set.distanceKm ?? 0), 0),
		sessionSeconds: sessionSeconds(session)
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

export function formatMetricValue(
	key: 'sets' | 'volume' | 'cardioTime' | 'cardioKm' | 'session',
	value: number | null
): string {
	if (value == null) return '—';
	switch (key) {
		case 'sets':
			return String(value);
		case 'volume':
			return `${formatKg(value)} kg`;
		case 'cardioTime':
			return formatDuration(value);
		case 'cardioKm':
			return `${formatNumber(value)} km`;
		case 'session':
			return formatDuration(value);
	}
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
		case 'cardio': {
			const target = exercise.target;
			const parts: string[] = [];
			if (target.sets && target.sets > 1) parts.push(`${target.sets} sets`);
			if (target.distanceKmMin != null && target.distanceKmMax != null) {
				parts.push(`${formatNumber(target.distanceKmMin)}–${formatNumber(target.distanceKmMax)} km`);
			} else if (target.distanceKm) {
				parts.push(`${formatNumber(target.distanceKm)} km`);
			}
			if (target.durationSeconds) parts.push(formatDuration(target.durationSeconds));
			return parts.join(' · ') || 'Cardio';
		}
	}
}

export function planHasDay(plan: Plan, dayId: string): PlanDay | undefined {
	return plan.days.find((day) => day.id === dayId);
}
