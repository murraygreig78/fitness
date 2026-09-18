<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fitness } from '$lib/app-state.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import RestTimer from '$lib/components/RestTimer.svelte';
	import { formatClock, formatDuration, formatKg, formatMuscle, formatNumber } from '$lib/format';
	import { sessionSeconds, targetPreview } from '$lib/metrics';
	import {
		durationUsesMinutes,
		fieldsForExercise,
		fieldLabel,
		findSet,
		previousSessionsFor,
		previousSetValue,
		stepForField,
		targetFieldValue,
		type LogField
	} from '$lib/previous';
	import {
		createSession,
		groupExercises,
		sessionStatus,
		setCount,
		type Exercise,
		type LoggedSet,
		type Session
	} from '$lib/schema';
	import { dateForWeekday, formatDayHeading, indexFromWeekday, mondayOf } from '$lib/week';
	import { onDestroy } from 'svelte';

	const dayId = $derived(page.params.dayId ?? '');
	const weekStart = $derived(page.url.searchParams.get('week') || fitness.weekStart || mondayOf());
	const day = $derived(fitness.plan?.days.find((item) => item.id === dayId));
	const session = $derived(day ? fitness.sessionFor(day.id, weekStart) : undefined);
	const previous = $derived.by(() => {
		if (!fitness.plan || !day) return [];
		const dayIndexById = Object.fromEntries(
			fitness.plan.days.map((item) => [item.id, indexFromWeekday(item.weekday)])
		);
		return previousSessionsFor(
			fitness.sessions,
			fitness.plan.id,
			dayId,
			weekStart,
			indexFromWeekday(day.weekday),
			dayIndexById
		);
	});

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
		if (!session?.startedAt || session.endedAt) return sessionSeconds(session);
		return Math.round((tick - Date.parse(session.startedAt)) / 1000);
	});

	const restRemaining = $derived(
		restUntil == null ? 0 : Math.max(0, Math.round((restUntil - now) / 1000))
	);

	$effect(() => {
		if (restUntil != null && restRemaining <= 0) restUntil = null;
	});

	async function ensure(): Promise<Session | null> {
		if (!fitness.plan || !day) return null;
		return fitness.ensureSession(day, weekStart);
	}

	async function startSession() {
		const current = await ensure();
		if (!current || current.startedAt) return;
		await fitness.saveSession({
			...current,
			startedAt: new Date().toISOString(),
			skipped: false,
			endedAt: null
		});
	}

	async function finishSession() {
		const current = await ensure();
		if (!current) return;
		const startedAt = current.startedAt ?? new Date().toISOString();
		await fitness.saveSession({
			...current,
			startedAt,
			endedAt: new Date().toISOString(),
			skipped: false
		});
		restUntil = null;
	}

	async function skipSession() {
		if (!fitness.plan || !day) return;
		const current = session ?? createSession(fitness.plan, day, weekStart);
		await fitness.saveSession({
			...current,
			skipped: true,
			endedAt: current.endedAt ?? new Date().toISOString(),
			startedAt: current.startedAt ?? new Date().toISOString()
		});
	}

	function displayField(exercise: Exercise, field: LogField, raw: number | undefined): string {
		if (raw == null) return '—';
		if (field === 'kg') return formatKg(raw);
		if (field === 'distanceKm') return formatNumber(raw);
		if (field === 'durationSeconds') {
			return durationUsesMinutes(exercise)
				? formatNumber(raw / 60)
				: formatDuration(raw);
		}
		return String(raw);
	}

	function editorValue(exercise: Exercise, field: LogField, raw: number | undefined) {
		if (raw == null) return undefined;
		if (field === 'durationSeconds' && durationUsesMinutes(exercise)) return raw / 60;
		return raw;
	}

	function commitValue(exercise: Exercise, field: LogField, next: number | undefined) {
		if (next == null) return undefined;
		if (field === 'durationSeconds' && durationUsesMinutes(exercise)) return next * 60;
		return next;
	}

	async function openEditor(exercise: Exercise, setIndex: number, field: LogField) {
		await startSession();
		editor = { exercise, setIndex, field };
	}

	async function saveField(next: number | undefined) {
		if (!editor) return;
		const current = await ensure();
		if (!current) return;
		const { exercise, setIndex, field } = editor;
		const converted = commitValue(exercise, field, next);
		const sets = current.sets.map((set) =>
			set.exerciseId === exercise.id && set.setIndex === setIndex
				? { ...set, [field]: converted }
				: set
		);
		await fitness.saveSession({ ...current, sets });
		editor = null;
	}

	async function toggleComplete(exercise: Exercise, setIndex: number) {
		const current = await ensure();
		if (!current) return;
		await startSession();
		const existing = findSet(current.sets, exercise.id, setIndex);
		const completed = !existing?.completed;
		const patch: LoggedSet = {
			exerciseId: exercise.id,
			setIndex,
			completed,
			kg: existing?.kg ?? targetFieldValue(exercise, 'kg'),
			reps: existing?.reps ?? targetFieldValue(exercise, 'reps'),
			durationSeconds: existing?.durationSeconds ?? targetFieldValue(exercise, 'durationSeconds'),
			distanceKm: existing?.distanceKm ?? targetFieldValue(exercise, 'distanceKm')
		};
		const sets = current.sets.some(
			(set) => set.exerciseId === exercise.id && set.setIndex === setIndex
		)
			? current.sets.map((set) =>
					set.exerciseId === exercise.id && set.setIndex === setIndex ? patch : set
				)
			: [...current.sets, patch];
		await fitness.saveSession({ ...current, sets });
		if (completed) {
			const rest = exercise.restSeconds ?? (exercise.kind === 'cardio' ? exercise.target.restSeconds : undefined);
			if (rest) restUntil = Date.now() + rest * 1000;
		}
	}

	function previousFor(exercise: Exercise, setIndex: number, field: LogField) {
		return previousSetValue(previous, exercise.id, setIndex, field) ?? targetFieldValue(exercise, field);
	}

	const status = $derived(sessionStatus(session, Boolean(day)));
</script>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan first.</p>
	<a class="mt-3 inline-block text-lime-300" href="/plan">Go to plan</a>
{:else if !day}
	<p class="text-sm text-zinc-400">That day is not in the current plan.</p>
	<button type="button" class="mt-3 text-lime-300" onclick={() => goto('/')}>Back to week</button>
{:else}
	{#if restRemaining > 0}
		<RestTimer secondsRemaining={restRemaining} onSkip={() => (restUntil = null)} />
	{/if}

	<header class="mb-5">
		<a href="/" class="text-sm text-zinc-400">← Week</a>
		<p class="mt-2 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
			{formatDayHeading(dateForWeekday(weekStart, day.weekday))}
		</p>
		<h1 class="text-2xl font-bold">{day.name}</h1>
		<p class="mt-1 text-sm text-zinc-400">
			{status === 'done' ? 'Finished' : status === 'skipped' ? 'Skipped' : 'Log each set as you go'}
			{#if liveSeconds != null}
				· {formatClock(liveSeconds)}
			{/if}
		</p>
	</header>

	<div class="mb-5 flex flex-wrap gap-2">
		{#if !session?.startedAt}
			<button
				type="button"
				class="rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-zinc-950"
				onclick={startSession}
			>
				Start session
			</button>
		{/if}
		{#if session?.startedAt && !session.endedAt}
			<button
				type="button"
				class="rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-zinc-950"
				onclick={finishSession}
			>
				Finish
			</button>
		{/if}
		{#if status !== 'skipped'}
			<button
				type="button"
				class="rounded-full border border-zinc-700 px-4 py-2 text-sm"
				onclick={skipSession}
			>
				Skip day
			</button>
		{/if}
	</div>

	<div class="space-y-4">
		{#each groupExercises(day.exercises) as group (group.supersetId ?? group.exercises[0].id)}
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
				{#if exercise.notes}
					<p class="mt-1 text-sm text-zinc-500">{exercise.notes}</p>
				{/if}

				<ol class="mt-3 space-y-2">
					{#each Array.from({ length: setCount(exercise) }) as _, setIndex}
						{@const logged = findSet(session?.sets ?? [], exercise.id, setIndex)}
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
											{#if field === 'durationSeconds' && durationUsesMinutes(exercise)}
												(min)
											{/if}
										</p>
										<p class="font-mono text-xl font-semibold">
											{displayField(exercise, field, logged?.[field])}
										</p>
										<p class="text-[11px] text-zinc-500">
											Prev {displayField(
												exercise,
												field,
												previousSetValue(previous, exercise.id, setIndex, field)
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

	<label class="mt-5 block">
		<span class="mb-2 block text-sm text-zinc-400">Session notes</span>
		<textarea
			class="min-h-24 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm"
			value={session?.notes ?? ''}
			onchange={async (event) => {
				const current = await ensure();
				if (!current) return;
				await fitness.saveSession({
					...current,
					notes: (event.currentTarget as HTMLTextAreaElement).value
				});
			}}
		></textarea>
	</label>
{/if}

{#if editor}
	{@const currentSet = findSet(session?.sets ?? [], editor.exercise.id, editor.setIndex)}
	{@const usesMinutes =
		editor.field === 'durationSeconds' && durationUsesMinutes(editor.exercise)}
	<Keypad
		label={`${editor.exercise.name} · set ${editor.setIndex + 1}`}
		unit={usesMinutes ? 'min' : fieldLabel(editor.field)}
		value={editorValue(editor.exercise, editor.field, currentSet?.[editor.field])}
		previous={editorValue(
			editor.exercise,
			editor.field,
			previousFor(editor.exercise, editor.setIndex, editor.field)
		)}
		target={editorValue(
			editor.exercise,
			editor.field,
			targetFieldValue(editor.exercise, editor.field)
		)}
		step={usesMinutes ? 1 : stepForField(editor.field)}
		allowDecimal={editor.field === 'kg' || editor.field === 'distanceKm' || usesMinutes}
		onCommit={saveField}
		onClose={() => (editor = null)}
	/>
{/if}
