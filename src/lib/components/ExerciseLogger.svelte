<script lang="ts">
	import Keypad from '$lib/components/Keypad.svelte';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import { formatClock, formatDuration, formatKg, formatMuscle } from '$lib/format';
	import { sessionSeconds, targetPreview } from '$lib/metrics';
	import {
		fieldsForExercise,
		fieldLabel,
		findSet,
		lastUsedFieldValue,
		setFieldValue,
		stepForField,
		targetFieldValue,
		type LogField
	} from '$lib/previous';
	import {
		displayedSetCount,
		groupExercises,
		restSecondsFor,
		setCount,
		type Activity,
		type Exercise,
		type LoggedSet,
		type Session
	} from '$lib/schema';
	import { onDestroy } from 'svelte';

	let {
		session,
		activity,
		exercises,
		previous,
		onSave,
		allowExtraSets = false
	}: {
		session: Session;
		activity: Activity;
		exercises: Exercise[];
		previous: Session[];
		onSave: (session: Session) => Promise<void>;
		allowExtraSets?: boolean;
	} = $props();

	let tick = $state(Date.now());
	let restUntil = $state<number | null>(null);
	let now = $state(Date.now());
	let editor = $state<{
		exercise: Exercise;
		setIndex: number;
		field: LogField;
	} | null>(null);
	let extraByExercise = $state<Record<string, number>>({});

	const interval = setInterval(() => {
		tick = Date.now();
		now = Date.now();
	}, 1000);
	onDestroy(() => clearInterval(interval));

	const liveSeconds = $derived.by(() => {
		if (!session.startedAt || session.endedAt) return sessionSeconds(session);
		return Math.round((tick - Date.parse(session.startedAt)) / 1000);
	});
	const restRemaining = $derived(
		restUntil == null ? 0 : Math.max(0, Math.round((restUntil - now) / 1000))
	);

	$effect(() => {
		if (restUntil != null && restRemaining <= 0) restUntil = null;
	});

	function displayField(exercise: Exercise, field: LogField, raw: number | undefined): string {
		if (raw == null) return '—';
		if (field === 'kg') return formatKg(raw);
		if (field === 'durationSeconds') return formatDuration(raw);
		return String(raw);
	}

	async function openEditor(exercise: Exercise, setIndex: number, field: LogField) {
		editor = { exercise, setIndex, field };
		if (session.startedAt) return;
		await onSave({
			...session,
			startedAt: new Date().toISOString(),
			skipped: false,
			endedAt: null
		});
	}

	function startRest(exercise: Exercise) {
		const seconds = restSecondsFor(exercise, activity);
		if (seconds > 0) restUntil = Date.now() + seconds * 1000;
	}

	function isCompletingField(exercise: Exercise, field: LogField) {
		const fields = fieldsForExercise(exercise);
		return fields[fields.length - 1] === field;
	}

	async function saveField(next: number | undefined) {
		const current = editor;
		if (!current) return;
		const { exercise, setIndex, field } = current;
		const existing = findSet(session.sets, exercise.id, setIndex);
		const completing = next != null && isCompletingField(exercise, field);
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			completed: completing ? true : (existing?.completed ?? false),
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds'),
			[field]: next
		};
		const sets = existing
			? session.sets.map((set) =>
					set.exerciseId === exercise.id && set.setIndex === setIndex ? { ...set, ...patch } : set
				)
			: [...session.sets, patch];
		editor = null;
		if (completing) startRest(exercise);
		await onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets
		});
	}

	async function toggleComplete(exercise: Exercise, setIndex: number) {
		const existing = findSet(session.sets, exercise.id, setIndex);
		const completed = !existing?.completed;
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			completed,
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds')
		};
		const sets = existing
			? session.sets.map((set) =>
					set.exerciseId === exercise.id && set.setIndex === setIndex ? patch : set
				)
			: [...session.sets, patch];
		if (completed) startRest(exercise);
		else restUntil = null;
		await onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets
		});
	}

	function lastFor(exercise: Exercise, setIndex: number, field: LogField) {
		return lastUsedFieldValue(session.sets, previous, exercise.id, setIndex, field);
	}

	function lastSet(exercise: Exercise): LoggedSet | undefined {
		return session.sets
			.filter((set) => set.exerciseId === exercise.id)
			.sort((a, b) => a.setIndex - b.setIndex)
			.at(-1);
	}

	function rowCount(exercise: Exercise): number {
		return Math.max(
			setCount(exercise) + (extraByExercise[exercise.id] ?? 0),
			displayedSetCount(exercise, session.sets)
		);
	}

	function setIndexes(exercise: Exercise): number[] {
		return Array.from({ length: rowCount(exercise) }, (_, index) => index);
	}

	function addSet(exercise: Exercise) {
		const nextIndex = rowCount(exercise);
		extraByExercise = {
			...extraByExercise,
			[exercise.id]: (extraByExercise[exercise.id] ?? 0) + 1
		};
		const prior = lastSet(exercise);
		const extra: LoggedSet = {
			exerciseId: exercise.id,
			setIndex: nextIndex,
			completed: false,
			kg: prior?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: prior?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: prior?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds')
		};
		void onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets: findSet(session.sets, exercise.id, nextIndex)
				? session.sets
				: [...session.sets, extra]
		});
	}
</script>

{#if restRemaining > 0}
	<RestTimer secondsRemaining={restRemaining} onSkip={() => (restUntil = null)} />
{/if}

{#if liveSeconds != null}
	<p class="mb-3 font-mono text-sm text-zinc-400">{formatClock(liveSeconds)}</p>
{/if}

<div class="space-y-4">
	{#each groupExercises(exercises) as group (group.supersetId ?? group.exercises[0].id)}
		{#if group.supersetId}
			<p class="px-1 text-xs font-semibold tracking-[0.18em] text-orange-300 uppercase">
				Superset · alternate, then rest
			</p>
		{/if}
		{#each group.exercises as exercise (exercise.id)}
			<article class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-lg font-semibold">{exercise.name}</h2>
						<p class="text-sm text-zinc-400">{targetPreview(exercise)}</p>
					</div>
					{#if exercise.videoUrl}
						<a
							class="shrink-0 text-sm font-semibold text-lime-300"
							href={exercise.videoUrl}
							target="_blank"
							rel="noreferrer"
						>
							Video
						</a>
					{/if}
				</div>
				{#if exercise.primaryMuscles.length}
					<p class="mt-2 flex flex-wrap gap-1">
						{#each exercise.primaryMuscles as muscle (muscle)}
							<span class="rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
								{formatMuscle(muscle)}
							</span>
						{/each}
					</p>
				{/if}
				{#if exercise.instructions}
					<p class="mt-2 text-sm leading-6 text-zinc-400">{exercise.instructions}</p>
				{/if}
				<ol class="mt-3 space-y-2">
					{#each setIndexes(exercise) as setIndex (setIndex)}
						{@const logged = findSet(session.sets, exercise.id, setIndex)}
						{@const extra = setIndex >= setCount(exercise)}
						<li class="rounded-2xl bg-zinc-950/70 p-3">
							<div class="mb-2 flex items-center justify-between">
								<p class="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
									Set {setIndex + 1}{extra ? ' · extra' : ''}
								</p>
								<button
									type="button"
									class="rounded-full px-3 py-1 text-xs font-semibold {logged?.completed
										? 'bg-lime-400 text-zinc-950'
										: 'bg-zinc-800 text-zinc-300'}"
									onclick={() => toggleComplete(exercise, setIndex)}
								>
									{logged?.completed ? 'Done' : 'Mark done'}
								</button>
							</div>
							<div class="grid grid-cols-2 gap-2">
								{#each fieldsForExercise(exercise) as field (field)}
									<button
										type="button"
										class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
										onclick={() => openEditor(exercise, setIndex, field)}
									>
										<p class="text-[11px] tracking-[0.16em] text-zinc-500 uppercase">
											{fieldLabel(field)}
										</p>
										<p class="font-mono text-xl font-semibold">
											{displayField(
												exercise,
												field,
												logged ? setFieldValue(logged, field) : undefined
											)}
										</p>
									</button>
								{/each}
							</div>
						</li>
					{/each}
				</ol>
				{#if allowExtraSets}
					<button
						type="button"
						class="mt-3 w-full rounded-2xl border border-dashed border-zinc-600 py-3 text-sm font-semibold text-zinc-200"
						onclick={() => addSet(exercise)}
					>
						Add set
					</button>
				{/if}
			</article>
		{/each}
	{/each}
</div>

{#if editor}
	{@const currentSet = findSet(session.sets, editor.exercise.id, editor.setIndex)}
	<Keypad
		label={`${editor.exercise.name} · set ${editor.setIndex + 1}`}
		unit={fieldLabel(editor.field)}
		value={currentSet ? setFieldValue(currentSet, editor.field) : undefined}
		last={lastFor(editor.exercise, editor.setIndex, editor.field)}
		step={stepForField(editor.field)}
		allowDecimal={editor.field === 'kg'}
		onCommit={saveField}
		onClose={() => (editor = null)}
	/>
{/if}
