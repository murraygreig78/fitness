<script lang="ts">
	import Keypad from '$lib/components/Keypad.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import { formatDuration, formatKg, formatMuscle, formVideoSearchUrl } from '$lib/format';
	import { targetPreview } from '$lib/metrics';
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
		applyExerciseTarget,
		displayedSetCount,
		isWarmupSet,
		restSecondsFor,
		restSecondsForSet,
		setCount,
		type Activity,
		type Exercise,
		type ExerciseTargetField,
		type LoggedSet,
		type Session
	} from '$lib/schema';
	import { playRestBeep, unlockBeep } from '$lib/beep';
	import { hasWarmupSets, lastWorkingKg, warmupAllowed, warmupSetsFor } from '$lib/warmup';
	import { onDestroy } from 'svelte';

	let {
		session,
		activity,
		exercises,
		previous,
		onSave,
		onUpdateExercise,
		allowExtraSets = false
	}: {
		session: Session;
		activity: Activity;
		exercises: Exercise[];
		previous: Session[];
		onSave: (session: Session) => Promise<void>;
		onUpdateExercise?: (exercise: Exercise) => Promise<void>;
		allowExtraSets?: boolean;
	} = $props();

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
	let editingTarget = $state(false);
	let targetField = $state<ExerciseTargetField | null>(null);
	let restBeepTimer: ReturnType<typeof setTimeout> | undefined;

	const interval = setInterval(() => {
		now = Date.now();
	}, 1000);
	onDestroy(() => {
		clearInterval(interval);
		clearRest(false);
	});

	const restRemaining = $derived(
		restUntil == null ? 0 : Math.max(0, Math.round((restUntil - now) / 1000))
	);

	function clearRest(playBeep: boolean) {
		if (restBeepTimer != null) {
			clearTimeout(restBeepTimer);
			restBeepTimer = undefined;
		}
		if (playBeep && restUntil != null) playRestBeep();
		restUntil = null;
	}

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
		if (seconds <= 0) return;
		void unlockBeep();
		clearRest(false);
		restUntil = Date.now() + seconds * 1000;
		restBeepTimer = setTimeout(() => {
			restBeepTimer = undefined;
			clearRest(true);
		}, seconds * 1000);
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
			...suggestedSet(exercise, setIndex, warmup),
			completed: completing ? true : (existing?.completed ?? false),
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
		const patch: LoggedSet = suggestedSet(exercise, setIndex, warmup, completed);
		const sets = upsertSet(session.sets, patch);
		if (completed) startRest(exercise, warmup);
		else clearRest(false);
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

	function suggestedField(
		exercise: Exercise,
		setIndex: number,
		field: LogField,
		warmup = false
	): number | undefined {
		const logged = findSet(session.sets, exercise.id, setIndex, warmup);
		const current = logged ? setFieldValue(logged, field) : undefined;
		if (current != null) return current;
		return lastFor(exercise, setIndex, field, warmup) ?? targetFieldValue(exercise, field);
	}

	function suggestedSet(
		exercise: Exercise,
		setIndex: number,
		warmup: boolean,
		completed?: boolean
	): LoggedSet {
		const existing = findSet(session.sets, exercise.id, setIndex, warmup);
		return {
			exerciseId: exercise.id,
			setIndex,
			warmup,
			completed: completed ?? existing?.completed ?? false,
			kg: suggestedField(exercise, setIndex, 'kg', warmup),
			reps: suggestedField(exercise, setIndex, 'reps', warmup),
			durationSeconds: suggestedField(exercise, setIndex, 'durationSeconds', warmup)
		};
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

	function targetFields(
		exercise: Exercise
	): {
		field: ExerciseTargetField;
		label: string;
		value: number | undefined;
		allowDecimal: boolean;
	}[] {
		const fields: {
			field: ExerciseTargetField;
			label: string;
			value: number | undefined;
			allowDecimal: boolean;
		}[] = [{ field: 'sets', label: 'sets', value: exercise.target.sets, allowDecimal: false }];
		if (exercise.kind === 'weighted' || exercise.kind === 'bodyweight') {
			fields.push({
				field: 'repsMin',
				label: 'reps min',
				value: exercise.target.repsMin,
				allowDecimal: false
			});
			fields.push({
				field: 'reps',
				label: 'reps',
				value: exercise.target.reps,
				allowDecimal: false
			});
		}
		if (exercise.kind === 'weighted') {
			fields.push({
				field: 'kg',
				label: 'kg',
				value: exercise.target.kg,
				allowDecimal: true
			});
		}
		if (exercise.kind === 'timed' || exercise.kind === 'stretch') {
			fields.push({
				field: 'durationSeconds',
				label: 'seconds',
				value: exercise.target.durationSeconds,
				allowDecimal: false
			});
		}
		fields.push({
			field: 'restSeconds',
			label: 'rest min',
			value: Number((restSecondsFor(exercise, activity) / 60).toFixed(2)),
			allowDecimal: true
		});
		return fields;
	}

	async function saveTarget(next: number | undefined) {
		const exercise = focusedExercise();
		const field = targetField;
		if (!exercise || !field || !onUpdateExercise) return;
		const value = field === 'restSeconds' ? (next == null ? undefined : next * 60) : next;
		const updated = applyExerciseTarget(exercise, field, value);
		if ('error' in updated) return;
		await onUpdateExercise(updated);
		targetField = null;
	}

	async function hydrateWorkingSets(exercise: Exercise) {
		let sets = session.sets;
		let changed = false;
		for (const setIndex of setIndexes(exercise)) {
			const existing = findSet(sets, exercise.id, setIndex, false);
			const next = suggestedSet(exercise, setIndex, false);
			const missing = fieldsForExercise(exercise).some((field) => {
				const current = existing ? setFieldValue(existing, field) : undefined;
				const suggested = suggestedField(exercise, setIndex, field, false);
				return current == null && suggested != null;
			});
			if (!missing) continue;
			sets = upsertSet(sets, next);
			changed = true;
		}
		if (!changed) return;
		await onSave({ ...session, sets });
	}

	$effect(() => {
		const exercise = exercises.find((item) => item.id === focusedId);
		if (!exercise) return;
		void hydrateWorkingSets(exercise);
	});
</script>

{#if restRemaining > 0}
	<RestTimer secondsRemaining={restRemaining} onSkip={() => clearRest(false)} />
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
			onclick={() => {
				focusedId = null;
				editingTarget = false;
				targetField = null;
			}}
		>
			<Icon name="back" class="h-4 w-4" />
			All exercises
		</button>
		<article class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="text-lg font-semibold">{exercise.name}</h2>
					{#if onUpdateExercise}
						<button
							type="button"
							class="text-sm text-zinc-400 underline decoration-zinc-600 underline-offset-4"
							onclick={() => {
								editor = null;
								editingTarget = true;
							}}
						>
							{targetPreview(exercise)}
						</button>
					{:else}
						<p class="text-sm text-zinc-400">{targetPreview(exercise)}</p>
					{/if}
				</div>
				<a
					class="shrink-0 text-sm font-semibold text-lime-300"
					href={formVideoSearchUrl(exercise.name)}
					target="_blank"
					rel="noreferrer"
				>
					Video
				</a>
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
											suggestedField(exercise, row.setIndex, field, row.warmup)
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
	{#key `${editor.exercise.id}:${editor.warmup ? 'w' : 's'}:${editor.setIndex}:${editor.field}`}
		<Keypad
			label={`${editor.exercise.name} · ${editor.warmup ? 'warm-up' : 'set'} ${editor.setIndex + 1}`}
			unit={fieldLabel(editor.field)}
			value={suggestedField(editor.exercise, editor.setIndex, editor.field, editor.warmup)}
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

{#if editingTarget}
	{@const exercise = focusedExercise()}
	{#if exercise}
		<div class="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/70 p-4 pb-28">
			<button
				type="button"
				class="absolute inset-0 cursor-default"
				aria-label="Close"
				onclick={() => {
					editingTarget = false;
					targetField = null;
				}}
			></button>
			<div class="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
				<p class="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">Prescription</p>
				<p class="mt-1 text-lg font-semibold">{exercise.name}</p>
				<p class="mt-1 text-sm text-zinc-400">{targetPreview(exercise)}</p>
				<p class="mt-2 text-xs leading-5 text-zinc-500">
					Saved into your weekly plan JSON. Export it from Admin when you want a copy.
				</p>
				<ul class="mt-4 space-y-2">
					{#each targetFields(exercise) as row (row.field)}
						<li>
							<button
								type="button"
								class="flex w-full items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3 text-left"
								onclick={() => {
									editor = null;
									targetField = row.field;
								}}
							>
								<span class="text-xs tracking-[0.16em] text-zinc-500 uppercase">{row.label}</span>
								<span class="font-mono text-xl font-semibold">
									{row.field === 'durationSeconds'
										? displayField(exercise, 'durationSeconds', row.value)
										: row.field === 'restSeconds'
											? formatDuration(restSecondsFor(exercise, activity))
											: row.value == null
												? '—'
												: row.field === 'kg'
													? formatKg(row.value)
													: String(row.value)}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
		{#if targetField}
			{@const row = targetFields(exercise).find((item) => item.field === targetField)}
			{#if row}
				{#key `${exercise.id}:${row.field}:${row.value ?? 'empty'}`}
					<Keypad
						label={`${exercise.name} · ${row.label}`}
						unit={row.label}
						value={row.value}
						last={row.field === 'kg' ? lastWorkingKg(session.sets, previous, exercise) : undefined}
						allowDecimal={row.allowDecimal}
						onCommit={saveTarget}
						onClose={() => (targetField = null)}
					/>
				{/key}
			{/if}
		{/if}
	{/if}
{/if}
