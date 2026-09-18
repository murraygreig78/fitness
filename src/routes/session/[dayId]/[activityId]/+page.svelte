<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fitness } from '$lib/app-state.svelte';
	import ExerciseLogger from '$lib/components/ExerciseLogger.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import { formatDuration, formatNumber } from '$lib/format';
	import { activityPreview } from '$lib/metrics';
	import {
		cardioTargetValue,
		previousCardioValue,
		previousSessionsFor
	} from '$lib/previous';
	import {
		activityKindLabel,
		createSession,
		exercisesInActivity,
		sessionStatus,
		type Session
	} from '$lib/schema';
	import { dateForWeekday, formatDayHeading, indexFromWeekday, mondayOf } from '$lib/week';
	import { untrack } from 'svelte';

	const dayId = $derived(page.params.dayId ?? '');
	const activityId = $derived(page.params.activityId ?? '');
	const weekStart = $derived(page.url.searchParams.get('week') || fitness.weekStart || mondayOf());
	const day = $derived(fitness.plan?.days.find((item) => item.id === dayId));
	const activity = $derived(day?.activities.find((item) => item.id === activityId));
	const session = $derived(
		day && activity ? fitness.sessionFor(day.id, activity.id, weekStart) : undefined
	);
	const previous = $derived.by(() => {
		if (!fitness.plan || !day || !activity) return [];
		const dayIndexById = Object.fromEntries(
			fitness.plan.days.map((item) => [item.id, indexFromWeekday(item.weekday)])
		);
		return previousSessionsFor(
			fitness.sessions,
			fitness.plan.id,
			activity.id,
			weekStart,
			day.id,
			indexFromWeekday(day.weekday),
			dayIndexById
		);
	});

	let cardioField = $state<'distanceKm' | 'durationSeconds' | null>(null);
	let statEditor = $state<{ statId: string; unit: string } | null>(null);

	async function ensure(): Promise<Session | null> {
		if (!fitness.plan || !day || !activity) return null;
		return fitness.ensureSession(day, activity, weekStart);
	}

	async function save(next: Session) {
		await fitness.saveSession(next);
	}

	async function startAnd(patch: (current: Session) => Session) {
		const current = await ensure();
		if (!current) return;
		const started = current.startedAt
			? current
			: { ...current, startedAt: new Date().toISOString(), skipped: false, endedAt: null };
		await save(patch(started));
	}

	async function finish() {
		await startAnd((current) => ({
			...current,
			endedAt: new Date().toISOString(),
			completed: true,
			skipped: false
		}));
	}

	async function skip() {
		if (!fitness.plan || !day || !activity) return;
		const current = session ?? createSession(fitness.plan, day, activity, weekStart);
		await save({
			...current,
			skipped: true,
			startedAt: current.startedAt ?? new Date().toISOString(),
			endedAt: current.endedAt ?? new Date().toISOString()
		});
	}

	const status = $derived(sessionStatus(session));

	$effect(() => {
		if (!fitness.ready || !day || !activity) return;
		if (activity.kind === 'strength' || activity.kind === 'mobility' || activity.kind === 'progress') {
			const currentDay = day;
			const currentActivity = activity;
			const currentWeek = weekStart;
			untrack(() => {
				void fitness.ensureSession(currentDay, currentActivity, currentWeek);
			});
		}
	});
</script>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan first.</p>
{:else if !day || !activity}
	<p class="text-sm text-zinc-400">That activity is not in the current plan.</p>
	<button type="button" class="mt-3 text-lime-300" onclick={() => goto('/')}>Back to week</button>
{:else}
	<header class="mb-5">
		<a href="/session/{day.id}?week={weekStart}" class="text-sm text-zinc-400">← {day.name}</a>
		<p class="mt-2 text-xs font-semibold tracking-[0.18em] text-lime-300 uppercase">
			{activityKindLabel(activity.kind)} · {formatDayHeading(dateForWeekday(weekStart, day.weekday))}
		</p>
		<h1 class="text-2xl font-bold">{activity.name}</h1>
		<p class="mt-1 text-sm text-zinc-400">{activityPreview(activity)}</p>
		{#if activity.instructions}
			<p class="mt-2 text-sm leading-6 text-zinc-400">{activity.instructions}</p>
		{/if}
	</header>

	<div class="mb-5 flex flex-wrap gap-2">
		{#if status !== 'done'}
			<button
				type="button"
				class="rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-zinc-950"
				onclick={finish}
			>
				Finish activity
			</button>
		{/if}
		{#if status !== 'skipped'}
			<button
				type="button"
				class="rounded-full border border-zinc-700 px-4 py-2 text-sm"
				onclick={skip}
			>
				Skip
			</button>
		{/if}
	</div>

	{#if activity.kind === 'cardio'}
		<div class="grid grid-cols-2 gap-3">
			<button
				type="button"
				class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-left"
				onclick={() => (cardioField = 'distanceKm')}
			>
				<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Distance</p>
				<p class="font-mono text-3xl font-semibold">{formatNumber(session?.distanceKm)} km</p>
				<p class="text-xs text-zinc-500">
					Prev {formatNumber(previousCardioValue(previous, 'distanceKm'))}
				</p>
			</button>
			<button
				type="button"
				class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-left"
				onclick={() => (cardioField = 'durationSeconds')}
			>
				<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Time</p>
				<p class="font-mono text-3xl font-semibold">
					{session?.durationSeconds != null
						? formatDuration(session.durationSeconds)
						: '—'}
				</p>
				<p class="text-xs text-zinc-500">
					Prev {formatDuration(previousCardioValue(previous, 'durationSeconds'))}
				</p>
			</button>
		</div>
	{:else if activity.kind === 'progress'}
		<div class="space-y-3">
			{#each activity.stats as stat (stat.id)}
				{@const logged = session?.stats.find((item) => item.statId === stat.id)}
				<button
					type="button"
					class="w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-4 text-left"
					onclick={() => (statEditor = { statId: stat.id, unit: stat.unit })}
				>
					<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">{stat.name}</p>
					<p class="font-mono text-3xl font-semibold">
						{logged?.value == null ? '—' : formatNumber(logged.value)}
						<span class="text-base text-zinc-500">{stat.unit}</span>
					</p>
				</button>
			{/each}
			{#if activity.allowPhoto}
				<label class="block rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
					<span class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Photo link</span>
					<input
						class="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm"
						placeholder="https://… or a local path"
						value={session?.photoUrl ?? ''}
						onblur={async (event) => {
							const value = (event.currentTarget as HTMLInputElement).value.trim();
							await startAnd((current) => ({ ...current, photoUrl: value || undefined }));
						}}
					/>
					<p class="mt-2 text-xs leading-5 text-zinc-500">
						A URL or file path only. The image itself is not stored in the browser.
					</p>
				</label>
			{/if}
		</div>
	{:else if session}
		<ExerciseLogger
			{session}
			exercises={exercisesInActivity(activity)}
			{previous}
			onSave={save}
			allowExtraSets={activity.kind === 'strength'}
		/>
	{/if}

	<label class="mt-5 block">
		<span class="mb-2 block text-sm text-zinc-400">Notes</span>
		<textarea
			class="min-h-24 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-sm"
			value={session?.notes ?? ''}
			onchange={async (event) => {
				const current = await ensure();
				if (!current) return;
				await save({
					...current,
					notes: (event.currentTarget as HTMLTextAreaElement).value
				});
			}}
		></textarea>
	</label>
{/if}

{#if cardioField && activity?.kind === 'cardio'}
	{@const usesMinutes = cardioField === 'durationSeconds'}
	<Keypad
		label={cardioField === 'distanceKm' ? activity.name : `${activity.name} time`}
		unit={usesMinutes ? 'min' : 'km'}
		value={usesMinutes
			? session?.durationSeconds != null
				? session.durationSeconds / 60
				: undefined
			: session?.distanceKm}
		previous={usesMinutes
			? previousCardioValue(previous, 'durationSeconds') != null
				? (previousCardioValue(previous, 'durationSeconds') ?? 0) / 60
				: cardioTargetValue(activity, 'durationSeconds') != null
					? (cardioTargetValue(activity, 'durationSeconds') ?? 0) / 60
					: undefined
			: (previousCardioValue(previous, 'distanceKm') ??
				cardioTargetValue(activity, 'distanceKm'))}
		target={usesMinutes
			? cardioTargetValue(activity, 'durationSeconds') != null
				? (cardioTargetValue(activity, 'durationSeconds') ?? 0) / 60
				: undefined
			: cardioTargetValue(activity, 'distanceKm')}
		step={usesMinutes ? 1 : 0.1}
		allowDecimal={true}
		onCommit={async (next) => {
			const converted = usesMinutes && next != null ? next * 60 : next;
			await startAnd((current) => ({
				...current,
				[cardioField!]: converted,
				completed: true
			}));
			cardioField = null;
		}}
		onClose={() => (cardioField = null)}
	/>
{/if}

{#if statEditor && activity?.kind === 'progress'}
	{@const currentStat = statEditor}
	{@const logged = session?.stats.find((item) => item.statId === currentStat.statId)}
	<Keypad
		label={activity.stats.find((stat) => stat.id === currentStat.statId)?.name ?? 'Stat'}
		unit={currentStat.unit}
		value={logged?.value}
		previous={undefined}
		target={undefined}
		step={currentStat.unit === 'kg' || currentStat.unit === 'cm' ? 0.1 : 1}
		allowDecimal={true}
		onCommit={async (next) => {
			await startAnd((current) => ({
				...current,
				stats: current.stats.map((stat) =>
					stat.statId === currentStat.statId ? { ...stat, value: next } : stat
				),
				completed: true
			}));
			statEditor = null;
		}}
		onClose={() => (statEditor = null)}
	/>
{/if}
