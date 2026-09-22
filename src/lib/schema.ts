import { z } from 'zod';

export const weekdays = [
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
	'sunday'
] as const;

export type Weekday = (typeof weekdays)[number];

export const weekdaySchema = z.enum(weekdays);

export const activityKinds = ['cardio', 'strength', 'mobility', 'progress'] as const;
export type ActivityKind = (typeof activityKinds)[number];

export const exerciseKindSchema = z.enum(['weighted', 'bodyweight', 'timed', 'stretch']);
export type ExerciseKind = z.infer<typeof exerciseKindSchema>;

const idSchema = z.string().min(1);
const optionalText = z.string().optional();

const weightedTargetSchema = z.object({
	sets: z.number().int().positive(),
	reps: z.number().positive(),
	repsMin: z.number().positive().optional(),
	kg: z.number().nonnegative()
});

const bodyweightTargetSchema = z.object({
	sets: z.number().int().positive(),
	reps: z.number().positive(),
	repsMin: z.number().positive().optional()
});

const timedTargetSchema = z.object({
	sets: z.number().int().positive(),
	durationSeconds: z.number().positive()
});

const cardioTargetSchema = z
	.object({
		distanceKm: z.number().positive().optional(),
		distanceKmMin: z.number().positive().optional(),
		distanceKmMax: z.number().positive().optional(),
		durationSeconds: z.number().positive().optional()
	})
	.refine((target) => target.durationSeconds != null || target.distanceKm != null, {
		message: 'Cardio activities need a distance and/or time'
	});

const exerciseBase = {
	id: idSchema,
	name: z.string().min(1),
	primaryMuscles: z.array(z.string().min(1)).default([]),
	videoUrl: optionalText,
	instructions: optionalText,
	notes: optionalText,
	restSeconds: z.number().nonnegative().optional(),
	supersetId: optionalText,
	warmup: z.boolean().default(false)
};

export const exerciseSchema = z.discriminatedUnion('kind', [
	z.object({ ...exerciseBase, kind: z.literal('weighted'), target: weightedTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('bodyweight'), target: bodyweightTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('timed'), target: timedTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('stretch'), target: timedTargetSchema })
]);

export type Exercise = z.infer<typeof exerciseSchema>;

export type ExerciseTargetField =
	| 'sets'
	| 'reps'
	| 'repsMin'
	| 'kg'
	| 'durationSeconds'
	| 'restSeconds';

export function applyExerciseTarget(
	exercise: Exercise,
	field: ExerciseTargetField,
	next: number | undefined
): Exercise | { error: string } {
	if (field === 'restSeconds') {
		const nextExercise: Record<string, unknown> = { ...exercise };
		if (next == null) delete nextExercise.restSeconds;
		else nextExercise.restSeconds = Math.max(0, Math.round(next));
		const parsed = exerciseSchema.safeParse(nextExercise);
		if (!parsed.success) return { error: formatZodError(parsed.error) };
		return parsed.data;
	}
	const target: Record<string, unknown> = { ...exercise.target };
	if (field === 'sets') {
		target.sets = Math.max(1, Math.round(next ?? exercise.target.sets));
	} else if (exercise.kind === 'weighted' && field === 'kg') {
		target.kg = Math.max(0, next ?? 0);
	} else if ((exercise.kind === 'weighted' || exercise.kind === 'bodyweight') && field === 'reps') {
		target.reps = Math.max(1, next ?? exercise.target.reps);
	} else if (
		(exercise.kind === 'weighted' || exercise.kind === 'bodyweight') &&
		field === 'repsMin'
	) {
		if (next == null || next <= 0) delete target.repsMin;
		else target.repsMin = next;
	} else if (
		(exercise.kind === 'timed' || exercise.kind === 'stretch') &&
		field === 'durationSeconds'
	) {
		target.durationSeconds = Math.max(1, next ?? exercise.target.durationSeconds);
	} else {
		return { error: 'That field is not on this exercise' };
	}
	const parsed = exerciseSchema.safeParse({ ...exercise, target });
	if (!parsed.success) return { error: formatZodError(parsed.error) };
	return parsed.data;
}

export const DEFAULT_STRENGTH_REST_SECONDS = 120;

const activityBase = {
	id: idSchema,
	name: z.string().min(1),
	instructions: optionalText,
	notes: optionalText,
	videoUrl: optionalText
};

export const statDefSchema = z.object({
	id: idSchema,
	name: z.string().min(1),
	unit: z.string().min(1)
});

export type StatDef = z.infer<typeof statDefSchema>;

export const activitySchema = z.discriminatedUnion('kind', [
	z.object({
		...activityBase,
		kind: z.literal('cardio'),
		target: cardioTargetSchema
	}),
	z.object({
		...activityBase,
		kind: z.literal('strength'),
		restSeconds: z.number().nonnegative().default(DEFAULT_STRENGTH_REST_SECONDS),
		exercises: z.array(exerciseSchema).min(1)
	}),
	z.object({
		...activityBase,
		kind: z.literal('mobility'),
		exercises: z.array(exerciseSchema).min(1)
	}),
	z.object({
		...activityBase,
		kind: z.literal('progress'),
		stats: z.array(statDefSchema).min(1),
		allowPhoto: z.boolean().default(true)
	})
]);

export type Activity = z.infer<typeof activitySchema>;

export const planDaySchema = z.object({
	id: idSchema,
	weekday: weekdaySchema,
	name: z.string().min(1),
	estimatedMinutes: z.number().positive().optional(),
	activities: z.array(activitySchema).min(1)
});

export type PlanDay = z.infer<typeof planDaySchema>;

export const planSchema = z.object({
	version: z.literal(2),
	id: idSchema,
	name: z.string().min(1),
	notes: optionalText,
	days: z.array(planDaySchema).min(1)
});

export type Plan = z.infer<typeof planSchema>;

export const loggedSetSchema = z.object({
	exerciseId: z.string().min(1),
	setIndex: z.number().int().nonnegative(),
	reps: z.number().nonnegative().optional(),
	kg: z.number().nonnegative().optional(),
	durationSeconds: z.number().nonnegative().optional(),
	completed: z.boolean(),
	warmup: z.boolean().default(false)
});

export type LoggedSet = z.infer<typeof loggedSetSchema>;

export const loggedStatSchema = z.object({
	statId: z.string().min(1),
	value: z.number().optional(),
	unit: z.string().min(1),
	photoUrl: optionalText
});

export type LoggedStat = z.infer<typeof loggedStatSchema>;

export const sessionSchema = z.object({
	id: z.string().min(1),
	weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	dayId: z.string().min(1),
	activityId: z.string().min(1),
	planId: z.string().min(1),
	kind: z.enum(activityKinds),
	startedAt: z.string().nullable(),
	endedAt: z.string().nullable(),
	skipped: z.boolean().default(false),
	notes: z.string().default(''),
	sets: z.array(loggedSetSchema).default([]),
	stats: z.array(loggedStatSchema).default([]),
	distanceKm: z.number().nonnegative().optional(),
	durationSeconds: z.number().nonnegative().optional(),
	photoUrl: optionalText,
	completed: z.boolean().default(false)
});

export type Session = z.infer<typeof sessionSchema>;

export const logsBackupSchema = z.object({
	version: z.literal(2),
	exportedAt: z.string(),
	plan: planSchema.nullable(),
	sessions: z.array(sessionSchema)
});

export type LogsBackup = z.infer<typeof logsBackupSchema>;

export function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((issue) => {
			const path = issue.path.length ? issue.path.join('.') : 'plan';
			return `${path}: ${issue.message}`;
		})
		.join('\n');
}

export function parsePlanJson(input: unknown): { plan: Plan } | { error: string } {
	const parsed = planSchema.safeParse(input);
	if (!parsed.success) {
		return { error: formatZodError(parsed.error) };
	}
	return { plan: parsed.data };
}

export function parseLogsBackup(input: unknown): { backup: LogsBackup } | { error: string } {
	const parsed = logsBackupSchema.safeParse(input);
	if (!parsed.success) {
		return { error: formatZodError(parsed.error) };
	}
	return { backup: parsed.data };
}

export function setCount(exercise: Exercise): number {
	return exercise.target.sets;
}

export function isWarmupSet(set: LoggedSet): boolean {
	return Boolean(set.warmup);
}

export function loggedSetCount(sets: LoggedSet[], exerciseId: string): number {
	const indexes = sets
		.filter((set) => set.exerciseId === exerciseId && !isWarmupSet(set))
		.map((set) => set.setIndex);
	if (!indexes.length) return 0;
	return Math.max(...indexes) + 1;
}

export function displayedSetCount(exercise: Exercise, sets: LoggedSet[]): number {
	return Math.max(setCount(exercise), loggedSetCount(sets, exercise.id));
}

export function mergeLoggedSets(current: LoggedSet[], incoming: LoggedSet[]): LoggedSet[] {
	const map = new Map<string, LoggedSet>();
	for (const set of current) {
		map.set(`${set.exerciseId}:${set.setIndex}:${isWarmupSet(set) ? 'w' : 's'}`, set);
	}
	for (const set of incoming) {
		map.set(`${set.exerciseId}:${set.setIndex}:${isWarmupSet(set) ? 'w' : 's'}`, set);
	}
	return [...map.values()].sort(
		(a, b) =>
			a.exerciseId.localeCompare(b.exerciseId) ||
			Number(isWarmupSet(b)) - Number(isWarmupSet(a)) ||
			a.setIndex - b.setIndex
	);
}

export function sessionId(weekStart: string, dayId: string, activityId: string): string {
	return `${weekStart}::${dayId}::${activityId}`;
}

export function emptySetsForActivity(activity: Activity): LoggedSet[] {
	if (activity.kind !== 'strength' && activity.kind !== 'mobility') return [];
	return activity.exercises.flatMap((exercise) =>
		Array.from({ length: setCount(exercise) }, (_, setIndex) => ({
			exerciseId: exercise.id,
			setIndex,
			warmup: false,
			completed: false
		}))
	);
}

export function restSecondsFor(exercise: Exercise, activity: Activity): number {
	if (exercise.restSeconds != null) return exercise.restSeconds;
	if (activity.kind === 'strength') {
		return activity.restSeconds ?? DEFAULT_STRENGTH_REST_SECONDS;
	}
	return 0;
}

export function restSecondsForSet(exercise: Exercise, activity: Activity, warmup: boolean): number {
	const full = restSecondsFor(exercise, activity);
	if (!warmup) return full;
	return Math.round(full / 2);
}

export function emptyStatsForActivity(activity: Activity): LoggedStat[] {
	if (activity.kind !== 'progress') return [];
	return activity.stats.map((stat) => ({
		statId: stat.id,
		unit: stat.unit
	}));
}

export function createSession(
	plan: Plan,
	day: PlanDay,
	activity: Activity,
	weekStart: string
): Session {
	return {
		id: sessionId(weekStart, day.id, activity.id),
		weekStart,
		dayId: day.id,
		activityId: activity.id,
		planId: plan.id,
		kind: activity.kind,
		startedAt: null,
		endedAt: null,
		skipped: false,
		notes: '',
		sets: emptySetsForActivity(activity),
		stats: emptyStatsForActivity(activity),
		completed: false
	};
}

export type SessionStatus = 'rest' | 'upcoming' | 'in-progress' | 'done' | 'skipped';

export function sessionStatus(session: Session | undefined): SessionStatus {
	if (!session) return 'upcoming';
	if (session.skipped) return 'skipped';
	if (session.endedAt || session.completed) return 'done';
	if (session.startedAt || session.sets.some((set) => set.completed) || hasProgressData(session)) {
		return 'in-progress';
	}
	return 'upcoming';
}

export function hasProgressData(session: Session): boolean {
	return (
		session.distanceKm != null ||
		session.durationSeconds != null ||
		Boolean(session.photoUrl) ||
		session.stats.some((stat) => stat.value != null || Boolean(stat.photoUrl))
	);
}

export function dayStatus(day: PlanDay, sessions: Session[]): SessionStatus {
	if (!day.activities.length) return 'rest';
	const byActivity = new Map(sessions.map((session) => [session.activityId, session]));
	const statuses = day.activities.map((activity) => sessionStatus(byActivity.get(activity.id)));
	if (statuses.every((status) => status === 'done')) return 'done';
	if (statuses.every((status) => status === 'skipped')) return 'skipped';
	if (statuses.some((status) => status === 'in-progress' || status === 'done'))
		return 'in-progress';
	return 'upcoming';
}

export function groupExercises(
	exercises: Exercise[]
): { supersetId?: string; exercises: Exercise[] }[] {
	const groups: { supersetId?: string; exercises: Exercise[] }[] = [];
	const seen = new Set<string>();
	for (const exercise of exercises) {
		if (seen.has(exercise.id)) continue;
		if (exercise.supersetId) {
			const pair = exercises.filter((item) => item.supersetId === exercise.supersetId);
			for (const item of pair) seen.add(item.id);
			groups.push({ supersetId: exercise.supersetId, exercises: pair });
			continue;
		}
		seen.add(exercise.id);
		groups.push({ exercises: [exercise] });
	}
	return groups;
}

export function activityKindLabel(kind: ActivityKind): string {
	switch (kind) {
		case 'cardio':
			return 'Cardio';
		case 'strength':
			return 'Strength';
		case 'mobility':
			return 'Mobility';
		case 'progress':
			return 'Progress';
	}
}

export function summarizeActivities(activities: Activity[]): string {
	const counts = new Map<ActivityKind, number>();
	for (const activity of activities) {
		counts.set(activity.kind, (counts.get(activity.kind) ?? 0) + 1);
	}
	const parts = activityKinds
		.filter((kind) => counts.get(kind))
		.map((kind) => {
			const count = counts.get(kind) ?? 0;
			return `${count} ${kind}`;
		});
	const total = activities.length;
	const noun = total === 1 ? 'activity' : 'activities';
	return `${total} ${noun} · ${parts.join(', ')}`;
}

export function exercisesInActivity(activity: Activity): Exercise[] {
	if (activity.kind === 'strength' || activity.kind === 'mobility') return activity.exercises;
	return [];
}

export function freeDayId(weekday: Weekday): string {
	return `free-${weekday}`;
}

export function dayIdForWeekday(plan: Plan | null, weekday: Weekday): string {
	return plan?.days.find((day) => day.weekday === weekday)?.id ?? freeDayId(weekday);
}

export function uniqueActivityKinds(activities: Activity[]): ActivityKind[] {
	const seen = new Set<ActivityKind>();
	const kinds: ActivityKind[] = [];
	for (const activity of activities) {
		if (seen.has(activity.kind)) continue;
		seen.add(activity.kind);
		kinds.push(activity.kind);
	}
	return kinds;
}

export function isAdhocActivityId(activityId: string): boolean {
	return activityId.startsWith('adhoc-');
}

export function createAdhocActivity(kind: ActivityKind): Activity {
	const id = `adhoc-${kind}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	switch (kind) {
		case 'cardio':
			return {
				id,
				name: 'Cardio',
				kind: 'cardio',
				target: { distanceKm: 3, durationSeconds: 1800 }
			};
		case 'strength':
			return {
				id,
				name: 'Strength',
				kind: 'strength',
				restSeconds: DEFAULT_STRENGTH_REST_SECONDS,
				exercises: [
					{
						id: `${id}-custom`,
						name: 'Custom',
						kind: 'weighted',
						primaryMuscles: [],
						warmup: false,
						target: { sets: 3, reps: 8, kg: 0 }
					}
				]
			};
		case 'mobility':
			return {
				id,
				name: 'Mobility',
				kind: 'mobility',
				exercises: [
					{
						id: `${id}-custom`,
						name: 'Custom',
						kind: 'stretch',
						primaryMuscles: [],
						warmup: false,
						target: { sets: 1, durationSeconds: 60 }
					}
				]
			};
		case 'progress':
			return {
				id,
				name: 'Stats',
				kind: 'progress',
				stats: [{ id: `${id}-weight`, name: 'Weight', unit: 'kg' }],
				allowPhoto: true
			};
	}
}

export function sessionDay(
	plan: Plan | null,
	weekday: Weekday,
	dayId: string,
	activity: Activity
): PlanDay {
	const existing = plan?.days.find((day) => day.id === dayId);
	if (existing) return existing;
	return {
		id: dayId,
		weekday,
		name: activityKindLabel(activity.kind),
		activities: [activity]
	};
}
