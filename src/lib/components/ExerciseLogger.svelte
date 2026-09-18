<script lang="ts">
	import Keypad from '$lib/components/Keypad.svelte';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import { formatClock, formatDuration, formatKg, formatMuscle } from '$lib/format';
	import { sessionSeconds, targetPreview } from '$lib/metrics';
	import {
		fieldsForExercise,
		fieldLabel,
		findSet,
		previousSetValue,
		setFieldValue,
		stepForField,
		targetFieldValue,
		type LogField
	} from '$lib/previous';
	import {
		groupExercises,
		setCount,
		type Exercise,
		type LoggedSet,
		type Session
	} from '$lib/schema';
	import { onDestroy } from 'svelte';

	let {
		session,
		exercises,
		previous,
		onSave
	}: {
		session: Session;
		exercises: Exercise[];
		previous: Session[];
		onSave: (session: Session) => Promise<void>;
	} = $props();

	let tick = $state(Date.now());
	let restUntil = $state<number | null>(null);
	let now = $state(Date.now());
	let editor = $state<{
		exercise: Exercise;
		setIndex: number;
		field: LogField;
	} | null>(null);

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

	async function saveField(next: number | undefined) {
		if (!editor) return;
		const { exercise, setIndex, field } = editor;
		const existing = findSet(session.sets, exercise.id, setIndex);
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			completed: existing?.completed ?? false,
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds'),
			[field]: next
		};
		const sets = existing
			? session.sets.map((set) =>
					set.exerciseId === exercise.id && set.setIndex === setIndex ? { ...set, [field]: next } : set
				)
			: [...session.sets, patch];
		await onSave({ ...session, sets });
		editor = null;
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
		await onSave({
			...session,
			startedAt: session.startedAt ?? new Date().toISOString(),
			skipped: false,
			endedAt: null,
			sets
		});
		if (completed && exercise.restSeconds) {
			restUntil = Date.now() + exercise.restSeconds * 1000;
		}
	}

	function previousFor(exercise: Exercise, setIndex: number, field: LogField) {
		return (
			previousSetValue(previous, exercise.id, setIndex, field) ??
			previousSetValue(previous, exercise.id, Math.max(0, setIndex - 1), field) ??
			targetFieldValue(exercise, field)
		);
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
					{#each Array.from({ length: setCount(exercise) }, (_, index) => index) as setIndex (setIndex)}
						{@const logged = findSet(session.sets, exercise.id, setIndex)}
						<li class="rounded-2xl bg-zinc-950/70 p-3">
							<div class="mb-2 flex items-center justify-between">
								<p class="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
									Set {setIndex + 1}
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
										<p class="text-[11px] text-zinc-500">
											Prev {displayField(
												exercise,
												field,
												previousSetValue(previous, exercise.id, setIndex, field) ??
													previousSetValue(previous, exercise.id, Math.max(0, setIndex - 1), field)
											)}
										</p>
									</button>
								{/each}
							</div>
						</li>
					{/each}
				</ol>
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
		previous={previousFor(editor.exercise, editor.setIndex, editor.field)}
		target={targetFieldValue(editor.exercise, editor.field)}
		step={stepForField(editor.field)}
		allowDecimal={editor.field === 'kg'}
		onCommit={saveField}
		onClose={() => (editor = null)}
	/>
{/if}
