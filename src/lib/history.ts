import type { Exercise, Plan, Session } from './schema';
import { volumeForSet } from './metrics';
import {
	formatDistance,
	formatWeight,
	kgToDisplay,
	weightUnitLabel,
	type DistanceUnit,
	type WeightUnit
} from './units';
import { addDays, calendarDays, dateForWeekday, toDateOnly } from './week';

export type TrendGrain = 'week' | 'day';

function sessionTrendDate(
	session: Session,
	grain: TrendGrain,
	dayIndexById: Record<string, number>
): string {
	if (grain === 'week') return session.weekStart;
	const index = dayIndexById[session.dayId];
	if (index == null) return session.weekStart;
	return dateForWeekday(session.weekStart, calendarDays[index]!);
}

export type WindowTotals = {
	activities: number;
	volumeKg: number;
	distanceKm: number;
};

export type RollingComparison = {
	current: WindowTotals;
	previous: WindowTotals;
	currentStart: string;
	currentEnd: string;
	previousStart: string;
	previousEnd: string;
};

function sessionHasWork(session: Session): boolean {
	if (session.skipped) return false;
	if (session.completed) return true;
	if (session.sets.some((set) => set.completed && !set.warmup)) return true;
	if ((session.distanceKm ?? 0) > 0 || (session.durationSeconds ?? 0) > 0) return true;
	if (session.stats.some((stat) => stat.value != null)) return true;
	return false;
}

function totalsForWindow(
	sessions: Session[],
	dayIndexById: Record<string, number>,
	start: string,
	end: string
): WindowTotals {
	let activities = 0;
	let volumeKg = 0;
	let distanceKm = 0;
	for (const session of sessions) {
		if (!sessionHasWork(session)) continue;
		const date = sessionTrendDate(session, 'day', dayIndexById);
		if (date < start || date > end) continue;
		activities += 1;
		distanceKm += session.distanceKm ?? 0;
		for (const set of session.sets) {
			if (!set.completed || set.warmup) continue;
			volumeKg += volumeForSet(set);
		}
	}
	return { activities, volumeKg, distanceKm };
}

/** Latest 7 calendar days vs the 7 days before that. */
export function rollingSevenDayComparison(
	sessions: Session[],
	dayIndexById: Record<string, number>,
	today = toDateOnly(new Date())
): RollingComparison {
	const currentEnd = today;
	const currentStart = addDays(today, -6);
	const previousEnd = addDays(today, -7);
	const previousStart = addDays(today, -13);
	return {
		current: totalsForWindow(sessions, dayIndexById, currentStart, currentEnd),
		previous: totalsForWindow(sessions, dayIndexById, previousStart, previousEnd),
		currentStart,
		currentEnd,
		previousStart,
		previousEnd
	};
}

export type ExerciseTrend = {
	id: string;
	name: string;
	kind: Exercise['kind'];
	points: number[];
	/** ISO date (week start) aligned with each point. */
	dates: string[];
	bestLabel: string;
	latestLabel: string;
};

export type CardioTrend = {
	id: 'distance' | 'duration';
	name: string;
	points: number[];
	dates: string[];
	bestLabel: string;
	latestLabel: string;
};

export type StatTrend = {
	id: string;
	name: string;
	unit: string;
	points: number[];
	dates: string[];
	bestLabel: string;
	latestLabel: string;
};

function max(values: number[]): number | undefined {
	if (!values.length) return undefined;
	return Math.max(...values);
}

export function catalogExercises(
	plan: Plan | null
): Map<string, { name: string; kind: Exercise['kind'] }> {
	const map = new Map<string, { name: string; kind: Exercise['kind'] }>();
	for (const day of plan?.days ?? []) {
		for (const activity of day.activities) {
			if (activity.kind !== 'strength' && activity.kind !== 'mobility') continue;
			for (const exercise of activity.exercises) {
				map.set(exercise.id, { name: exercise.name, kind: exercise.kind });
			}
		}
	}
	return map;
}

export function exerciseTrends(
	plan: Plan | null,
	sessions: Session[],
	weightUnit: WeightUnit = 'kg',
	grain: TrendGrain = 'week',
	dayIndexById: Record<string, number> = {}
): ExerciseTrend[] {
	const catalog = catalogExercises(plan);
	const byExercise = new Map<
		string,
		{ kg: number[]; kgDates: string[]; volume: number[]; reps: number[]; repDates: string[] }
	>();

	const ordered = [...sessions]
		.filter((session) => !session.skipped)
		.sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.id.localeCompare(b.id));

	for (const session of ordered) {
		const date = sessionTrendDate(session, grain, dayIndexById);
		const grouped = new Map<string, typeof session.sets>();
		for (const set of session.sets.filter((item) => item.completed && !item.warmup)) {
			const list = grouped.get(set.exerciseId) ?? [];
			list.push(set);
			grouped.set(set.exerciseId, list);
		}
		for (const [exerciseId, sets] of grouped) {
			const bucket = byExercise.get(exerciseId) ?? {
				kg: [],
				kgDates: [],
				volume: [],
				reps: [],
				repDates: []
			};
			const kgs = sets.map((set) => set.kg).filter((value): value is number => value != null);
			const vols = sets.map((set) => volumeForSet(set));
			const reps = sets.map((set) => set.reps).filter((value): value is number => value != null);
			if (kgs.length) {
				bucket.kg.push(Math.max(...kgs));
				bucket.kgDates.push(date);
			}
			if (vols.length) bucket.volume.push(Math.max(...vols));
			if (reps.length) {
				bucket.reps.push(Math.max(...reps));
				bucket.repDates.push(date);
			}
			byExercise.set(exerciseId, bucket);
		}
	}

	const trends: ExerciseTrend[] = [];
	for (const [id, bucket] of byExercise) {
		const meta = catalog.get(id);
		const useKg = bucket.kg.length > 0;
		const points = useKg ? bucket.kg : bucket.reps;
		const dates = useKg ? bucket.kgDates : bucket.repDates;
		if (!points.length) continue;
		const bestKg = max(bucket.kg);
		const bestReps = max(bucket.reps);
		const bestVolume = max(bucket.volume);
		const latest = points.at(-1);
		trends.push({
			id,
			name: meta?.name ?? id,
			kind: meta?.kind ?? 'weighted',
			points,
			dates,
			bestLabel:
				bestKg != null
					? `Best ${formatWeight(bestKg, weightUnit)}${
							bestVolume
								? ` · ${Math.round(kgToDisplay(bestVolume, weightUnit))} ${weightUnitLabel(weightUnit)}·reps`
								: ''
						}`
					: bestReps != null
						? `Best ${bestReps} reps`
						: 'Best —',
			latestLabel:
				latest == null
					? '—'
					: useKg
						? formatWeight(latest, weightUnit)
						: `${latest} reps`
		});
	}
	return trends.sort((a, b) => a.name.localeCompare(b.name));
}

export function cardioTrends(
	sessions: Session[],
	distanceUnit: DistanceUnit = 'km',
	grain: TrendGrain = 'week',
	dayIndexById: Record<string, number> = {}
): CardioTrend[] {
	const ordered = [...sessions]
		.filter((session) => session.kind === 'cardio' && !session.skipped)
		.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
	const distanceRows = ordered
		.map((session) =>
			session.distanceKm != null
				? { value: session.distanceKm, date: sessionTrendDate(session, grain, dayIndexById) }
				: null
		)
		.filter((row): row is { value: number; date: string } => row != null);
	const durationRows = ordered
		.map((session) =>
			session.durationSeconds != null
				? {
						value: session.durationSeconds,
						date: sessionTrendDate(session, grain, dayIndexById)
					}
				: null
		)
		.filter((row): row is { value: number; date: string } => row != null);
	const trends: CardioTrend[] = [];
	if (distanceRows.length) {
		const distances = distanceRows.map((row) => row.value);
		const best = max(distances) ?? 0;
		const latest = distances.at(-1);
		trends.push({
			id: 'distance',
			name: 'Walk / run distance',
			points: distances,
			dates: distanceRows.map((row) => row.date),
			bestLabel: `Best ${formatDistance(best, distanceUnit)}`,
			latestLabel: formatDistance(latest, distanceUnit)
		});
	}
	if (durationRows.length) {
		const durations = durationRows.map((row) => row.value);
		const best = max(durations) ?? 0;
		const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
		trends.push({
			id: 'duration',
			name: 'Walk / run time',
			points: durations,
			dates: durationRows.map((row) => row.date),
			bestLabel: `Longest ${minutes(best)}`,
			latestLabel: minutes(durations.at(-1) ?? 0)
		});
	}
	return trends;
}

export function statTrends(
	plan: Plan | null,
	sessions: Session[],
	grain: TrendGrain = 'week',
	dayIndexById: Record<string, number> = {}
): StatTrend[] {
	const names = new Map<string, { name: string; unit: string }>();
	for (const day of plan?.days ?? []) {
		for (const activity of day.activities) {
			if (activity.kind !== 'progress') continue;
			for (const stat of activity.stats) {
				names.set(stat.id, { name: stat.name, unit: stat.unit });
			}
		}
	}
	const ordered = [...sessions]
		.filter((session) => session.kind === 'progress' && !session.skipped)
		.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
	const byStat = new Map<string, { points: number[]; dates: string[] }>();
	for (const session of ordered) {
		const date = sessionTrendDate(session, grain, dayIndexById);
		for (const stat of session.stats) {
			if (stat.value == null) continue;
			const bucket = byStat.get(stat.statId) ?? { points: [], dates: [] };
			bucket.points.push(stat.value);
			bucket.dates.push(date);
			byStat.set(stat.statId, bucket);
			if (!names.has(stat.statId)) names.set(stat.statId, { name: stat.statId, unit: stat.unit });
		}
	}
	return [...byStat.entries()].map(([id, bucket]) => {
		const meta = names.get(id);
		const best = max(bucket.points);
		const latest = bucket.points.at(-1);
		return {
			id,
			name: meta?.name ?? id,
			unit: meta?.unit ?? '',
			points: bucket.points,
			dates: bucket.dates,
			bestLabel: best == null ? 'Best —' : `Best ${best} ${meta?.unit ?? ''}`.trim(),
			latestLabel: latest == null ? '—' : `${latest} ${meta?.unit ?? ''}`.trim()
		};
	});
}
