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

export const exerciseKindSchema = z.enum(['weighted', 'bodyweight', 'timed', 'cardio', 'stretch']);
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
		sets: z.number().int().positive().optional(),
		durationSeconds: z.number().positive().optional(),
		distanceKm: z.number().positive().optional(),
		distanceKmMin: z.number().positive().optional(),
		distanceKmMax: z.number().positive().optional(),
		restSeconds: z.number().nonnegative().optional()
	})
	.refine((target) => target.durationSeconds != null || target.distanceKm != null, {
		message: 'Cardio targets need a duration and/or distance'
	});

const exerciseBase = {
	id: idSchema,
	name: z.string().min(1),
	primaryMuscles: z.array(z.string().min(1)).default([]),
	videoUrl: optionalText,
	instructions: optionalText,
	notes: optionalText,
	restSeconds: z.number().nonnegative().optional(),
	supersetId: optionalText
};

export const exerciseSchema = z.discriminatedUnion('kind', [
	z.object({ ...exerciseBase, kind: z.literal('weighted'), target: weightedTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('bodyweight'), target: bodyweightTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('timed'), target: timedTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('cardio'), target: cardioTargetSchema }),
	z.object({ ...exerciseBase, kind: z.literal('stretch'), target: timedTargetSchema })
]);

export type Exercise = z.infer<typeof exerciseSchema>;

export const planDaySchema = z.object({
	id: idSchema,
	weekday: weekdaySchema,
	name: z.string().min(1),
	estimatedMinutes: z.number().positive().optional(),
	exercises: z.array(exerciseSchema).min(1)
});

export type PlanDay = z.infer<typeof planDaySchema>;

export const planSchema = z.object({
	version: z.literal(1),
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
	distanceKm: z.number().nonnegative().optional(),
	completed: z.boolean()
});

export type LoggedSet = z.infer<typeof loggedSetSchema>;

export const sessionSchema = z.object({
	id: z.string().min(1),
	weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	dayId: z.string().min(1),
	planId: z.string().min(1),
	startedAt: z.string().nullable(),
	endedAt: z.string().nullable(),
	skipped: z.boolean().default(false),
	notes: z.string().default(''),
	sets: z.array(loggedSetSchema)
});

export type Session = z.infer<typeof sessionSchema>;

export const logsBackupSchema = z.object({
	version: z.literal(1),
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
	if (exercise.kind === 'cardio') {
		return exercise.target.sets ?? 1;
	}
	return exercise.target.sets;
}

export function sessionId(weekStart: string, dayId: string): string {
	return `${weekStart}::${dayId}`;
}

export function emptySetsForDay(day: PlanDay): LoggedSet[] {
	return day.exercises.flatMap((exercise) =>
		Array.from({ length: setCount(exercise) }, (_, setIndex) => ({
			exerciseId: exercise.id,
			setIndex,
			completed: false
		}))
	);
}

export function createSession(plan: Plan, day: PlanDay, weekStart: string): Session {
	return {
		id: sessionId(weekStart, day.id),
		weekStart,
		dayId: day.id,
		planId: plan.id,
		startedAt: null,
		endedAt: null,
		skipped: false,
		notes: '',
		sets: emptySetsForDay(day)
	};
}

export type SessionStatus = 'rest' | 'upcoming' | 'in-progress' | 'done' | 'skipped';

export function sessionStatus(session: Session | undefined, isScheduled: boolean): SessionStatus {
	if (!isScheduled) return 'rest';
	if (!session) return 'upcoming';
	if (session.skipped) return 'skipped';
	if (session.endedAt) return 'done';
	if (session.startedAt || session.sets.some((set) => set.completed)) return 'in-progress';
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
