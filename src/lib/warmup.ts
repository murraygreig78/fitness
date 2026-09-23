import { targetFieldValue } from './previous';
import { isWarmupSet, type Activity, type Exercise, type LoggedSet, type Session } from './schema';

export const DEFAULT_WARMUP_STEPS = [
	{ reps: 12, percent: 0.3 },
	{ reps: 10, percent: 0.5 },
	{ reps: 4, percent: 0.7 }
] as const;

export function warmupAllowed(exercise: Exercise, activity?: Activity): boolean {
	if (exercise.kind !== 'weighted') return false;
	if (activity && activity.kind !== 'strength') return false;
	return true;
}

export function roundWarmupKg(kg: number): number {
	return Math.max(0, Math.round(kg * 2) / 2);
}

export function hasWarmupSets(sets: LoggedSet[], exerciseId: string): boolean {
	return sets.some((set) => set.exerciseId === exerciseId && isWarmupSet(set));
}

export function lastWorkingKg(
	currentSets: LoggedSet[],
	previousSessions: Session[],
	exercise: Exercise
): number {
	for (const session of previousSessions) {
		const kgs = session.sets
			.filter(
				(set) =>
					set.exerciseId === exercise.id && !isWarmupSet(set) && set.completed && set.kg != null
			)
			.sort((a, b) => b.setIndex - a.setIndex)
			.map((set) => set.kg)
			.filter((kg): kg is number => kg != null);
		if (kgs.length) return kgs[0];
	}
	const current = currentSets
		.filter((set) => set.exerciseId === exercise.id && !isWarmupSet(set) && set.kg != null)
		.sort((a, b) => b.setIndex - a.setIndex);
	if (current[0]?.kg != null) return current[0].kg;
	return targetFieldValue(exercise, 'kg') ?? 0;
}

export function warmupSetsFor(exercise: Exercise, baseKg: number): LoggedSet[] {
	return DEFAULT_WARMUP_STEPS.map((step, setIndex) => ({
		exerciseId: exercise.id,
		setIndex,
		warmup: true,
		completed: false,
		kg: roundWarmupKg(baseKg * step.percent),
		reps: step.reps
	}));
}
