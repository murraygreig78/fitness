import type { Exercise, Plan, Session } from './schema';
import { volumeForSet } from './metrics';

export type ExerciseTrend = {
	id: string;
	name: string;
	kind: Exercise['kind'];
	points: number[];
	bestLabel: string;
	latestLabel: string;
};

export type CardioTrend = {
	id: 'distance' | 'duration';
	name: string;
	points: number[];
	bestLabel: string;
	latestLabel: string;
};

export type StatTrend = {
	id: string;
	name: string;
	unit: string;
	points: number[];
	bestLabel: string;
	latestLabel: string;
};

function max(values: number[]): number | undefined {
	if (!values.length) return undefined;
	return Math.max(...values);
}

function formatKg(value: number): string {
	return `${Number(value.toFixed(2))} kg`;
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

export function exerciseTrends(plan: Plan | null, sessions: Session[]): ExerciseTrend[] {
	const catalog = catalogExercises(plan);
	const byExercise = new Map<string, { kg: number[]; volume: number[]; reps: number[] }>();

	const ordered = [...sessions]
		.filter((session) => !session.skipped)
		.sort((a, b) => a.weekStart.localeCompare(b.weekStart) || a.id.localeCompare(b.id));

	for (const session of ordered) {
		const grouped = new Map<string, typeof session.sets>();
		for (const set of session.sets.filter((item) => item.completed && !item.warmup)) {
			const list = grouped.get(set.exerciseId) ?? [];
			list.push(set);
			grouped.set(set.exerciseId, list);
		}
		for (const [exerciseId, sets] of grouped) {
			const bucket = byExercise.get(exerciseId) ?? { kg: [], volume: [], reps: [] };
			const kgs = sets.map((set) => set.kg).filter((value): value is number => value != null);
			const vols = sets.map((set) => volumeForSet(set));
			const reps = sets.map((set) => set.reps).filter((value): value is number => value != null);
			if (kgs.length) bucket.kg.push(Math.max(...kgs));
			if (vols.length) bucket.volume.push(Math.max(...vols));
			if (reps.length) bucket.reps.push(Math.max(...reps));
			byExercise.set(exerciseId, bucket);
		}
	}

	const trends: ExerciseTrend[] = [];
	for (const [id, bucket] of byExercise) {
		const meta = catalog.get(id);
		const points = bucket.kg.length ? bucket.kg : bucket.reps;
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
			bestLabel:
				bestKg != null
					? `Best ${formatKg(bestKg)}${bestVolume ? ` · ${Math.round(bestVolume)} kg·reps` : ''}`
					: bestReps != null
						? `Best ${bestReps} reps`
						: 'Best —',
			latestLabel: latest == null ? '—' : bucket.kg.length ? formatKg(latest) : `${latest} reps`
		});
	}
	return trends.sort((a, b) => a.name.localeCompare(b.name));
}

export function cardioTrends(sessions: Session[]): CardioTrend[] {
	const ordered = [...sessions]
		.filter((session) => session.kind === 'cardio' && !session.skipped)
		.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
	const distances = ordered
		.map((session) => session.distanceKm)
		.filter((value): value is number => value != null);
	const durations = ordered
		.map((session) => session.durationSeconds)
		.filter((value): value is number => value != null);
	const trends: CardioTrend[] = [];
	if (distances.length) {
		const best = max(distances) ?? 0;
		trends.push({
			id: 'distance',
			name: 'Walk / run distance',
			points: distances,
			bestLabel: `Best ${best} km`,
			latestLabel: `${distances.at(-1)} km`
		});
	}
	if (durations.length) {
		const best = max(durations) ?? 0;
		const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
		trends.push({
			id: 'duration',
			name: 'Walk / run time',
			points: durations,
			bestLabel: `Longest ${minutes(best)}`,
			latestLabel: minutes(durations.at(-1) ?? 0)
		});
	}
	return trends;
}

export function statTrends(plan: Plan | null, sessions: Session[]): StatTrend[] {
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
	const byStat = new Map<string, number[]>();
	for (const session of ordered) {
		for (const stat of session.stats) {
			if (stat.value == null) continue;
			const list = byStat.get(stat.statId) ?? [];
			list.push(stat.value);
			byStat.set(stat.statId, list);
			if (!names.has(stat.statId)) names.set(stat.statId, { name: stat.statId, unit: stat.unit });
		}
	}
	return [...byStat.entries()].map(([id, points]) => {
		const meta = names.get(id);
		const best = max(points);
		const latest = points.at(-1);
		return {
			id,
			name: meta?.name ?? id,
			unit: meta?.unit ?? '',
			points,
			bestLabel: best == null ? 'Best —' : `Best ${best} ${meta?.unit ?? ''}`.trim(),
			latestLabel: latest == null ? '—' : `${latest} ${meta?.unit ?? ''}`.trim()
		};
	});
}
