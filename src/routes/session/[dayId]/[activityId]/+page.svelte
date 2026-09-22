<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { kindIconName, kindTextClass } from '$lib/activity-style';
	import { fitness } from '$lib/app-state.svelte';
	import ExerciseLogger from '$lib/components/ExerciseLogger.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Keypad from '$lib/components/Keypad.svelte';
	import LastTime from '$lib/components/LastTime.svelte';
	import { formatClock, formatDuration, formatNumber } from '$lib/format';
	import { activityPreview, sessionSeconds } from '$lib/metrics';
	import {
		lastCompletedSession,
		previousCardioValue,
		previousSessionsFor,
		previousSessionsForKind,
		previousStatValue
	} from '$lib/previous';
	import {
		dayIdForWeekday,
		exercisesInActivity,
		freeDayId,
		isAdhocActivityId,
		sessionDay,
		sessionStatus,
		type Session,
		type Weekday
	} from '$lib/schema';
	import {
		calendarDays,
		dateForWeekday,
		formatDayHeading,
		formatDayLong,
		indexFromWeekday,
		normalizeWeekStart,
		sundayOf
	} from '$lib/week';
	import { onDestroy, untrack } from 'svelte';

	const dayId = $derived(page.params.dayId ?? '');
	const activityId = $derived(page.params.activityId ?? '');
	const weekStart = $derived(
		normalizeWeekStart(page.url.searchParams.get('week') || fitness.weekStart || sundayOf())
	);
	const custom = $derived(fitness.customActivity(activityId, weekStart));
	const planDay = $derived(fitness.plan?.days.find((item) => item.id === dayId));
	const activity = $derived(
		planDay?.activities.find((item) => item.id === activityId) ?? custom?.activity
	);
	const weekday = $derived(planDay?.weekday ?? custom?.weekday);
	const day = $derived(
		activity && weekday ? sessionDay(fitness.plan, weekday, dayId, activity) : undefined
	);
	const session = $derived(
		day && activity ? fitness.sessionFor(day.id, activity.id, weekStart) : undefined
	);

	const dayIndexById = $derived.by(() => {
		const map: Record<string, number> = {};
		for (const item of calendarDays) {
			map[freeDayId(item)] = indexFromWeekday(item);
			map[dayIdForWeekday(fitness.plan, item)] = indexFromWeekday(item);
		}
		for (const item of fitness.plan?.days ?? []) {
			map[item.id] = indexFromWeekday(item.weekday);
		}
		for (const item of fitness.customActivities) {
			map[item.dayId] = indexFromWeekday(item.weekday);
		}
		return map;
	});

	const previous = $derived.by(() => {
		if (!fitness.plan || !day || !activity) return [];
		const args = [
			fitness.sessions,
			fitness.plan.id,
			weekStart,
			day.id,
			indexFromWeekday(day.weekday),
			dayIndexById
		] as const;
		if (isAdhocActivityId(activity.id)) {
			return previousSessionsForKind(
				args[0],
				args[1],
				activity.kind,
				args[2],
				args[3],
				args[4],
				args[5]
			);
		}
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
	const last = $derived(lastCompletedSession(previous));
	const lastLabel = $derived(
		last && weekday
			? formatDayHeading(dateForWeekday(last.weekStart, weekdayFromSession(last) ?? weekday))
			: ''
	);

	function weekdayFromSession(item: Session): Weekday | undefined {
		const planned = fitness.plan?.days.find((entry) => entry.id === item.dayId);
		if (planned) return planned.weekday;
		const stored = fitness.customActivities.find((entry) => entry.dayId === item.dayId);
		return stored?.weekday;
	}

	let cardioField = $state<'distanceKm' | 'durationSeconds' | null>(null);
	let statEditor = $state<{ statId: string; unit: string } | null>(null);
	let tick = $state(Date.now());
	const clock = setInterval(() => {
		tick = Date.now();
	}, 1000);
	onDestroy(() => clearInterval(clock));

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

	async function start() {
		await startAnd((current) => current);
	}

	async function complete() {
		await startAnd((current) => ({
			...current,
			endedAt: new Date().toISOString(),
			completed: true,
			skipped: false
		}));
	}

	const status = $derived(sessionStatus(session));
	const liveSeconds = $derived.by(() => {
		tick;
		if (!session?.startedAt || session.endedAt) return sessionSeconds(session);
		return Math.round((Date.now() - Date.parse(session.startedAt)) / 1000);
	});

	$effect(() => {
		if (!fitness.ready || !day || !activity) return;
		if (
			activity.kind === 'strength' ||
			activity.kind === 'mobility' ||
			activity.kind === 'progress'
		) {
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
	<button type="button" class="mt-3 text-lime-300" onclick={() => goto(resolve('/'))}
		>Back to week</button
	>
{:else}
	<header class="mb-5">
		<a
			href={resolve(`/?week=${weekStart}`)}
			class="inline-flex items-center text-zinc-400"
			aria-label="Back to week"
		>
			<Icon name="back" class="h-5 w-5" />
		</a>
		<div class="mt-3 flex items-center gap-2 {kindTextClass(activity.kind)}">
			<Icon name={kindIconName(activity.kind)} class="h-5 w-5" />
			<p class="text-sm text-zinc-400">{formatDayLong(dateForWeekday(weekStart, day.weekday))}</p>
		</div>
		<h1 class="mt-1 text-2xl font-semibold">{activity.name}</h1>
		<p class="mt-1 text-sm text-zinc-500">{activityPreview(activity)}</p>
		{#if activity.instructions}
			<p class="mt-2 text-sm leading-6 text-zinc-400">{activity.instructions}</p>
		{/if}
	</header>

	<LastTime {activity} {last} weekdayLabel={lastLabel} />

	<div class="mb-5">
		{#if status !== 'done' && !session?.startedAt}
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-zinc-950"
				onclick={() => void start()}
			>
				<Icon name="timer" class="h-5 w-5" />
				Start
			</button>
		{:else if liveSeconds != null}
			<p class="inline-flex items-center gap-2 font-mono text-2xl font-semibold tabular-nums">
				<Icon name="timer" class="h-5 w-5 text-lime-300" />
				{formatClock(liveSeconds)}
			</p>
		{/if}
	</div>

	{#if activity.kind === 'cardio'}
		<div class="grid grid-cols-2 gap-3">
			<button
				type="button"
				class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left"
				onclick={() => (cardioField = 'distanceKm')}
			>
				<p class="text-xs text-zinc-500">Distance</p>
				<p class="font-mono text-3xl font-semibold">{formatNumber(session?.distanceKm)} km</p>
			</button>
			<button
				type="button"
				class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left"
				onclick={() => (cardioField = 'durationSeconds')}
			>
				<p class="text-xs text-zinc-500">Time</p>
				<p class="font-mono text-3xl font-semibold">
					{session?.durationSeconds != null ? formatDuration(session.durationSeconds) : '—'}
				</p>
			</button>
		</div>
	{:else if activity.kind === 'progress'}
		<div class="space-y-3">
			{#each activity.stats as stat (stat.id)}
				{@const logged = session?.stats.find((item) => item.statId === stat.id)}
				<button
					type="button"
					class="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left"
					onclick={() => (statEditor = { statId: stat.id, unit: stat.unit })}
				>
					<p class="text-xs text-zinc-500">{stat.name}</p>
					<p class="font-mono text-3xl font-semibold">
						{logged?.value == null ? '—' : formatNumber(logged.value)}
						<span class="text-base text-zinc-500">{stat.unit}</span>
					</p>
				</button>
			{/each}
			{#if activity.allowPhoto}
				<label class="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
					<span class="text-xs text-zinc-500">Photo link</span>
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
			{activity}
			exercises={exercisesInActivity(activity)}
			{previous}
			onSave={save}
			onUpdateExercise={async (exercise) => {
				await fitness.updateExercise(activity.id, exercise);
			}}
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
			}}></textarea>
	</label>

	{#if status !== 'done'}
		<button
			type="button"
			class="mt-6 w-full rounded-2xl bg-lime-400 py-4 text-base font-semibold text-zinc-950"
			onclick={() => void complete()}
		>
			Completed
		</button>
	{/if}
{/if}

{#if cardioField && activity?.kind === 'cardio'}
	{@const field = cardioField}
	{@const usesMinutes = field === 'durationSeconds'}
	{#key field}
		<Keypad
			label={field === 'distanceKm' ? activity.name : `${activity.name} time`}
			unit={usesMinutes ? 'min' : 'km'}
			value={usesMinutes
				? session?.durationSeconds != null
					? session.durationSeconds / 60
					: undefined
				: session?.distanceKm}
			last={usesMinutes
				? previousCardioValue(previous, 'durationSeconds') != null
					? (previousCardioValue(previous, 'durationSeconds') ?? 0) / 60
					: undefined
				: previousCardioValue(previous, 'distanceKm')}
			allowDecimal={true}
			onCommit={async (next) => {
				const converted = usesMinutes && next != null ? next * 60 : next;
				await startAnd((current) => ({
					...current,
					[field]: converted
				}));
				cardioField = field === 'distanceKm' ? 'durationSeconds' : null;
			}}
			onClose={() => (cardioField = null)}
		/>
	{/key}
{/if}

{#if statEditor && activity?.kind === 'progress'}
	{@const currentStat = statEditor}
	{@const logged = session?.stats.find((item) => item.statId === currentStat.statId)}
	{#key currentStat.statId}
		<Keypad
			label={activity.stats.find((stat) => stat.id === currentStat.statId)?.name ?? 'Stat'}
			unit={currentStat.unit}
			value={logged?.value}
			last={previousStatValue(previous, currentStat.statId, currentStat.unit)}
			allowDecimal={true}
			onCommit={async (next) => {
				await startAnd((current) => ({
					...current,
					stats: current.stats.map((stat) =>
						stat.statId === currentStat.statId ? { ...stat, value: next } : stat
					)
				}));
				const stats = activity.stats;
				const index = stats.findIndex((stat) => stat.id === currentStat.statId);
				const following = index >= 0 ? stats[index + 1] : undefined;
				statEditor = following ? { statId: following.id, unit: following.unit } : null;
			}}
			onClose={() => (statEditor = null)}
		/>
	{/key}
{/if}
