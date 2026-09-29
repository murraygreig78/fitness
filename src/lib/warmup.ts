import { targetFieldValue } from './previous';
import { isWarmupSet, type Exercise, type LoggedSet, type Session } from './schema';

/** Last logged working weight for hints (ignores legacy in-session warm-up sets). */
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
