<script lang="ts">
	import Keypad from '$lib/components/Keypad.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import { formatClock, formatDuration, formatKg, formatMuscle } from '$lib/format';
	import { sessionSeconds, targetPreview } from '$lib/metrics';
	import {
		fieldsForExercise,
		fieldLabel,
		findSet,
		lastUsedFieldValue,
		setFieldValue,
		targetFieldValue,
		type LogField
	} from '$lib/previous';
	import {
		displayedSetCount,
		isWarmupSet,
		restSecondsForSet,
		setCount,
		type Activity,
		type Exercise,
		type LoggedSet,
		type Session
	} from '$lib/schema';
	import { hasWarmupSets, lastWorkingKg, warmupAllowed, warmupSetsFor } from '$lib/warmup';
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
		warmup: boolean;
	} | null>(null);
	let extraByExercise = $state<Record<string, number>>({});
	let focusedId = $state<string | null>(null);

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

	async function openEditor(exercise: Exercise, setIndex: number, field: LogField, warmup = false) {
		editor = { exercise, setIndex, field, warmup };
		if (session.startedAt) return;
		await onSave({
			...session,
			startedAt: new Date().toISOString(),
			skipped: false,
			endedAt: null
		});
	}

	function startRest(exercise: Exercise, warmup = false) {
		const seconds = restSecondsForSet(exercise, activity, warmup);
		if (seconds > 0) restUntil = Date.now() + seconds * 1000;
	}

	function isCompletingField(exercise: Exercise, field: LogField) {
		const fields = fieldsForExercise(exercise);
		return fields[fields.length - 1] === field;
	}

	function nextEditor(
		exercise: Exercise,
		setIndex: number,
		field: LogField,
		warmup: boolean
	): { exercise: Exercise; setIndex: number; field: LogField; warmup: boolean } | null {
		const fields = fieldsForExercise(exercise);
		const fieldIndex = fields.indexOf(field);
		if (fieldIndex >= 0 && fieldIndex < fields.length - 1) {
			return { exercise, setIndex, field: fields[fieldIndex + 1], warmup };
		}
		return null;
	}

	function plannedSetsDone(exercise: Exercise, sets: LoggedSet[]): boolean {
		return Array.from({ length: setCount(exercise) }, (_, index) =>
			Boolean(findSet(sets, exercise.id, index, false)?.completed)
		).every(Boolean);
	}

	function completedSetCount(exercise: Exercise): number {
		return session.sets.filter(
			(set) => set.exerciseId === exercise.id && set.completed && !isWarmupSet(set)
		).length;
	}

	function upsertSet(sets: LoggedSet[], patch: LoggedSet): LoggedSet[] {
		const existing = findSet(sets, patch.exerciseId, patch.setIndex, Boolean(patch.warmup));
		if (!existing) return [...sets, patch];
		return sets.map((set) =>
			set.exerciseId === patch.exerciseId &&
			set.setIndex === patch.setIndex &&
			Boolean(set.warmup) === Boolean(patch.warmup)
				? { ...set, ...patch }
				: set
		);
	}

	async function saveField(next: number | undefined) {
		const current = editor;
		if (!current) return;
		const { exercise, setIndex, field, warmup } = current;
		const existing = findSet(session.sets, exercise.id, setIndex, warmup);
		const completing = next != null && isCompletingField(exercise, field);
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			warmup,
			completed: completing ? true : (existing?.completed ?? false),
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds'),
			[field]: next
		};
		const sets = upsertSet(session.sets, patch);
		const resting = completing && restSecondsForSet(exercise, activity, warmup) > 0;
		editor = resting ? null : nextEditor(exercise, setIndex, field, warmup);
		if (completing) startRest(exercise, warmup);
		await onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets
		});
		if (!warmup && plannedSetsDone(exercise, sets)) focusedId = null;
	}

	async function toggleComplete(exercise: Exercise, setIndex: number, warmup = false) {
		const existing = findSet(session.sets, exercise.id, setIndex, warmup);
		const completed = !existing?.completed;
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			warmup,
			completed,
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds')
		};
		const sets = upsertSet(session.sets, patch);
		if (completed) startRest(exercise, warmup);
		else restUntil = null;
		await onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets
		});
		if (completed && !warmup && plannedSetsDone(exercise, sets)) focusedId = null;
	}

	function lastFor(exercise: Exercise, setIndex: number, field: LogField, warmup = false) {
		return lastUsedFieldValue(session.sets, previous, exercise.id, setIndex, field, warmup);
	}

	function lastSet(exercise: Exercise): LoggedSet | undefined {
		return session.sets
			.filter((set) => set.exerciseId === exercise.id && !isWarmupSet(set))
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

	function visibleRows(exercise: Exercise): { setIndex: number; warmup: boolean }[] {
		const warmupRows = session.sets
			.filter((set) => set.exerciseId === exercise.id && isWarmupSet(set))
			.sort((a, b) => a.setIndex - b.setIndex)
			.map((set) => ({ setIndex: set.setIndex, warmup: true }));
		const workRows = setIndexes(exercise).map((setIndex) => ({ setIndex, warmup: false }));
		return [...warmupRows, ...workRows];
	}

	function addWarmup(exercise: Exercise) {
		if (!warmupAllowed(exercise) || hasWarmupSets(session.sets, exercise.id)) return;
		const baseKg = lastWorkingKg(session.sets, previous, exercise);
		void onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets: [...session.sets, ...warmupSetsFor(exercise, baseKg)]
		});
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
			warmup: false,
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
			sets: findSet(session.sets, exercise.id, nextIndex, false)
				? session.sets
				: [...session.sets, extra]
		});
	}
	function focusedExercise(): Exercise | undefined {
		return exercises.find((exercise) => exercise.id === focusedId);
	}
</script>

{#if restRemaining > 0}
	<RestTimer secondsRemaining={restRemaining} onSkip={() => (restUntil = null)} />
{/if}

{#if liveSeconds != null}
	<p class="mb-3 font-mono text-sm text-zinc-400">{formatClock(liveSeconds)}</p>
{/if}

{#if !focusedId}
	<div class="space-y-2">
		{#each exercises as exercise (exercise.id)}
			{@const done = plannedSetsDone(exercise, session.sets)}
			<button
				type="button"
				class="flex w-full items-center gap-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-left"
				onclick={() => (focusedId = exercise.id)}
			>
				<span
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {done
						? 'bg-lime-400 text-zinc-950'
						: 'bg-zinc-800 text-zinc-400'}"
				>
					<Icon name={done ? 'check' : 'circle'} class="h-5 w-5" />
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-lg font-semibold">{exercise.name}</span>
					<span class="block text-sm text-zinc-400">{targetPreview(exercise)}</span>
					<span class="mt-1 block text-xs text-zinc-500">
						{completedSetCount(exercise)} / {rowCount(exercise)} sets
					</span>
				</span>
			</button>
		{/each}
	</div>
{:else}
	{@const exercise = focusedExercise()}
	{#if exercise}
		<button
			type="button"
			class="mb-3 inline-flex items-center gap-1 text-sm text-zinc-400"
			onclick={() => (focusedId = null)}
		>
			<Icon name="back" class="h-4 w-4" />
			All exercises
		</button>
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
			{#if exercise.supersetId}
				<p class="mt-2 text-xs font-semibold tracking-[0.18em] text-orange-300 uppercase">
					Superset · alternate, then rest
				</p>
			{/if}
			{#if warmupAllowed(exercise) && !hasWarmupSets(session.sets, exercise.id)}
				<button
					type="button"
					class="mt-3 w-full rounded-2xl border border-lime-400/40 py-3 text-sm font-semibold text-lime-300"
					onclick={() => addWarmup(exercise)}
				>
					Warm up
				</button>
			{/if}
			<ol class="mt-3 space-y-2">
				{#each visibleRows(exercise) as row (`${row.warmup ? 'w' : 's'}:${row.setIndex}`)}
					{@const logged = findSet(session.sets, exercise.id, row.setIndex, row.warmup)}
					{@const extra = !row.warmup && row.setIndex >= setCount(exercise)}
					<li class="rounded-2xl bg-zinc-950/70 p-3">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
								{#if row.warmup}
									Warm-up {row.setIndex + 1}
								{:else}
									Set {row.setIndex + 1}{extra ? ' · extra' : ''}
								{/if}
							</p>
							<button
								type="button"
								class="flex h-9 w-9 items-center justify-center rounded-full {logged?.completed
									? 'bg-lime-400 text-zinc-950'
									: 'bg-zinc-800 text-zinc-400'}"
								aria-label={logged?.completed ? 'Set complete' : 'Mark set complete'}
								onclick={() => toggleComplete(exercise, row.setIndex, row.warmup)}
							>
								<Icon name={logged?.completed ? 'check' : 'circle'} class="h-5 w-5" />
							</button>
						</div>
						<div class="grid grid-cols-2 gap-2">
							{#each fieldsForExercise(exercise) as field (field)}
								<button
									type="button"
									class="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
									onclick={() => openEditor(exercise, row.setIndex, field, row.warmup)}
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
	{/if}
{/if}

{#if editor}
	{@const currentSet = findSet(session.sets, editor.exercise.id, editor.setIndex, editor.warmup)}
	{#key `${editor.exercise.id}:${editor.warmup ? 'w' : 's'}:${editor.setIndex}:${editor.field}`}
		<Keypad
			label={`${editor.exercise.name} · ${editor.warmup ? 'warm-up' : 'set'} ${editor.setIndex + 1}`}
			unit={fieldLabel(editor.field)}
			value={currentSet ? setFieldValue(currentSet, editor.field) : undefined}
			last={lastFor(editor.exercise, editor.setIndex, editor.field, editor.warmup)}
			allowDecimal={editor.field === 'kg'}
			showTimer={true}
			onCommit={saveField}
			onClose={() => (editor = null)}
			onTimer={() => {
				const current = editor;
				if (!current) return;
				startRest(current.exercise, current.warmup);
				editor = null;
			}}
		/>
	{/key}
{/if}
