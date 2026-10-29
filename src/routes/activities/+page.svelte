<script lang="ts">
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TrendsOverlay, { type TrendSeries } from '$lib/components/TrendsOverlay.svelte';
	import { cardioTrends, exerciseTrends, statTrends, type TrendGrain } from '$lib/history';
	import {
		dayIdForWeekday,
		freeDayId
	} from '$lib/schema';
	import { formatDistance, formatWeight } from '$lib/units';
	import {
		calendarDays,
		dateForWeekday,
		formatWeekRange,
		indexFromWeekday,
		normalizeWeekStart,
		parseDateOnly,
		shiftWeek,
		sundayOf
	} from '$lib/week';

	let query = $state('');
	let chartRange = $state<TrendGrain>('week');
	let focusWeekStart = $state(sundayOf());

	onMount(() => {
		const hasPlan = Boolean(fitness.plan);
		const hasLogs = fitness.sessions.some((session) => session.completed || session.sets.length);
		track('activities_view', {
			has_plan: hasPlan,
			has_logs: hasLogs
		});
		if (fitness.weekStart) focusWeekStart = normalizeWeekStart(fitness.weekStart);
	});

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

	const hasHistory = $derived(
		fitness.sessions.some((session) => !session.skipped && (session.completed || session.sets.length))
	);
	const empty = $derived(!hasHistory);

	const rangeLifts = $derived(
		exerciseTrends(
			fitness.plan,
			fitness.sessions,
			fitness.preferences.weightUnit,
			chartRange,
			dayIndexById
		)
	);
	const rangeCardio = $derived(
		cardioTrends(
			fitness.sessions,
			fitness.preferences.distanceUnit,
			chartRange,
			dayIndexById
		)
	);
	const rangeStats = $derived(
		statTrends(fitness.plan, fitness.sessions, chartRange, dayIndexById)
	);

	const weekBounds = $derived.by(() => {
		const weeks = fitness.sessions
			.filter((session) => !session.skipped)
			.map((session) => session.weekStart)
			.sort((a, b) => a.localeCompare(b));
		return {
			earliest: weeks[0] ?? focusWeekStart,
			latest: weeks.at(-1) ?? focusWeekStart
		};
	});

	const canPrevWeek = $derived(focusWeekStart > weekBounds.earliest);
	const canNextWeek = $derived(focusWeekStart < weekBounds.latest);

	const dayDomain = $derived(
		calendarDays.map((weekday) => dateForWeekday(focusWeekStart, weekday))
	);

	const needle = $derived(query.trim().toLowerCase());

	function rankName(name: string): number {
		if (!needle) return 0;
		const lower = name.toLowerCase();
		if (lower === needle) return 0;
		if (lower.startsWith(needle)) return 1;
		const wordStart = lower.split(/[^a-z0-9]+/).some((part) => part.startsWith(needle));
		if (wordStart) return 2;
		if (lower.includes(needle)) return 3;
		return 99;
	}

	function filterRows<T extends { name: string }>(rows: T[]): T[] {
		if (!needle) return rows;
		return rows
			.filter((row) => rankName(row.name) < 99)
			.sort((a, b) => rankName(a.name) - rankName(b.name) || a.name.localeCompare(b.name));
	}

	type ListRow = {
		id: string;
		name: string;
		points: number[];
		dates: string[];
		latestLabel: string;
		bestLabel: string;
		unit?: string;
		metric?: 'distance' | 'duration';
	};

	function indexesForRange(dates: string[]): number[] {
		if (chartRange === 'week') return dates.map((_, index) => index);
		const weekSet = new Set(dayDomain);
		return dates
			.map((date, index) => (weekSet.has(date) ? index : -1))
			.filter((index) => index >= 0);
	}

	const shownLifts = $derived.by((): ListRow[] => {
		const weightUnit = fitness.preferences.weightUnit;
		return filterRows(rangeLifts).flatMap((row) => {
			const indexes = indexesForRange(row.dates);
			if (!indexes.length) return [];
			const points = indexes.map((index) => row.points[index]!);
			const dates = indexes.map((index) => row.dates[index]!);
			const usesWeight = /\b(kg|lb)\b/i.test(row.latestLabel);
			const latest = points.at(-1);
			const best = Math.max(...points);
			return [
				{
					id: row.id,
					name: row.name,
					points,
					dates,
					latestLabel:
						latest == null
							? '—'
							: usesWeight
								? formatWeight(latest, weightUnit)
								: `${latest} reps`,
					bestLabel: usesWeight
						? `Best ${formatWeight(best, weightUnit)}`
						: `Best ${best} reps`
				}
			];
		});
	});

	const shownCardio = $derived.by((): ListRow[] => {
		const distanceUnit = fitness.preferences.distanceUnit;
		return filterRows(rangeCardio).flatMap((row) => {
			const indexes = indexesForRange(row.dates);
			if (!indexes.length) return [];
			const points = indexes.map((index) => row.points[index]!);
			const dates = indexes.map((index) => row.dates[index]!);
			const latest = points.at(-1);
			const best = Math.max(...points);
			const asDistance = row.id === 'distance';
			const label = (value: number) =>
				asDistance ? formatDistance(value, distanceUnit) : `${Math.round(value / 60)} min`;
			return [
				{
					id: row.id,
					name: row.name,
					points,
					dates,
					latestLabel: latest == null ? '—' : label(latest),
					bestLabel: asDistance ? `Best ${label(best)}` : `Longest ${label(best)}`,
					metric: row.id
				}
			];
		});
	});

	const shownStats = $derived.by((): ListRow[] => {
		return filterRows(rangeStats).flatMap((row) => {
			const indexes = indexesForRange(row.dates);
			if (!indexes.length) return [];
			const points = indexes.map((index) => row.points[index]!);
			const dates = indexes.map((index) => row.dates[index]!);
			const latest = points.at(-1);
			const best = Math.max(...points);
			return [
				{
					id: row.id,
					name: row.name,
					points,
					dates,
					latestLabel: latest == null ? '—' : `${latest} ${row.unit}`.trim(),
					bestLabel: `Best ${best} ${row.unit}`.trim(),
					unit: row.unit
				}
			];
		});
	});

	const noMatches = $derived(
		Boolean(needle) && !shownLifts.length && !shownCardio.length && !shownStats.length
	);

	const rangeEmpty = $derived(
		!shownLifts.length && !shownCardio.length && !shownStats.length && !needle
	);

	const overlaySeries = $derived.by((): TrendSeries[] => {
		const weightUnit = fitness.preferences.weightUnit;
		const distanceUnit = fitness.preferences.distanceUnit;
		const series: TrendSeries[] = [];

		for (const row of shownLifts) {
			const usesWeight = /\b(kg|lb)\b/i.test(row.latestLabel);
			series.push({
				id: `lift:${row.id}`,
				name: row.name,
				points: row.points,
				dates: row.dates,
				labels: row.points.map((value) =>
					usesWeight ? formatWeight(value, weightUnit) : `${value} reps`
				)
			});
		}
		for (const row of shownCardio) {
			series.push({
				id: `cardio:${row.id}`,
				name: row.name,
				points: row.points,
				dates: row.dates,
				labels: row.points.map((value) =>
					row.metric === 'distance'
						? formatDistance(value, distanceUnit)
						: `${Math.round(value / 60)} min`
				)
			});
		}
		for (const row of shownStats) {
			series.push({
				id: `stat:${row.id}`,
				name: row.name,
				points: row.points,
				dates: row.dates,
				labels: row.points.map((value) => `${value} ${row.unit ?? ''}`.trim())
			});
		}
		return series.filter((item) => item.points.length > 0);
	});

	function setChartRange(next: TrendGrain) {
		chartRange = next;
		if (next === 'day') {
			focusWeekStart = normalizeWeekStart(weekBounds.latest);
		}
	}

	function spark(points: number[]): string {
		if (points.length < 2) return '';
		const min = Math.min(...points);
		const max = Math.max(...points);
		const span = max - min || 1;
		return points
			.map((value, index) => {
				const x = (index / (points.length - 1)) * 100;
				const y = 28 - ((value - min) / span) * 24;
				return `${x},${y}`;
			})
			.join(' ');
	}

	function timelineMarks(
		dates: string[]
	): { key: string; day: string; month: string | null; left: number }[] {
		if (dates.length < 2) return [];
		return dates.map((date, index) => {
			const parsed = parseDateOnly(date);
			const monthKey = `${parsed.getFullYear()}-${parsed.getMonth()}`;
			const previous = index > 0 ? parseDateOnly(dates[index - 1]!) : null;
			const previousKey = previous
				? `${previous.getFullYear()}-${previous.getMonth()}`
				: null;
			return {
				key: `${date}:${index}`,
				day: String(parsed.getDate()),
				month:
					monthKey !== previousKey
						? parsed.toLocaleDateString(undefined, { month: 'short' })
						: null,
				left: (index / (dates.length - 1)) * 100
			};
		});
	}
</script>

<header class="mb-6">
	<h1 class="text-2xl font-semibold">Activities</h1>
	<p class="mt-1 text-sm leading-6 text-zinc-400">
		Past work, with the best mark and a simple trend. Body stats stay as links, not photo files.
	</p>
</header>

{#if !fitness.plan}
	<p class="text-sm leading-6 text-zinc-400">
		Load a weekly plan from the home screen or Admin, then log a week.
	</p>
{:else if empty}
	<p class="text-sm leading-6 text-zinc-400">
		Nothing logged yet. Finish a set, a walk, or Sunday stats and they will show up here.
	</p>
{:else}
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<div class="flex rounded-2xl border border-zinc-800 bg-zinc-900 p-1">
			<button
				type="button"
				class="rounded-xl px-3 py-1.5 text-sm font-semibold {chartRange === 'week'
					? 'bg-lime-400 text-zinc-950'
					: 'text-zinc-400'}"
				onclick={() => setChartRange('week')}
			>
				Week
			</button>
			<button
				type="button"
				class="rounded-xl px-3 py-1.5 text-sm font-semibold {chartRange === 'day'
					? 'bg-lime-400 text-zinc-950'
					: 'text-zinc-400'}"
				onclick={() => setChartRange('day')}
			>
				Day
			</button>
		</div>

		{#if chartRange === 'day'}
			<div class="ml-auto flex items-center gap-1">
				<button
					type="button"
					class="rounded-xl border border-zinc-800 p-2 text-zinc-300 disabled:opacity-30"
					aria-label="Previous week"
					disabled={!canPrevWeek}
					onclick={() => (focusWeekStart = shiftWeek(focusWeekStart, -1))}
				>
					<Icon name="chevronLeft" class="h-4 w-4" />
				</button>
				<p class="min-w-36 text-center text-sm text-zinc-300">{formatWeekRange(focusWeekStart)}</p>
				<button
					type="button"
					class="rounded-xl border border-zinc-800 p-2 text-zinc-300 disabled:opacity-30"
					aria-label="Next week"
					disabled={!canNextWeek}
					onclick={() => (focusWeekStart = shiftWeek(focusWeekStart, 1))}
				>
					<Icon name="chevronRight" class="h-4 w-4" />
				</button>
			</div>
		{/if}
	</div>

	<TrendsOverlay
		series={overlaySeries}
		domainDates={chartRange === 'day' ? dayDomain : null}
		caption={chartRange === 'day' ? 'Unique activities per day' : 'Unique activities per week'}
	/>

	<label class="mb-6 block">
		<span class="sr-only">Search activities</span>
		<input
			type="search"
			class="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500"
			placeholder="Search lifts, cardio, or stats…"
			bind:value={query}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
		/>
	</label>

	{#if noMatches}
		<p class="text-sm leading-6 text-zinc-400">No activities match “{query.trim()}”.</p>
	{:else if rangeEmpty}
		<p class="text-sm leading-6 text-zinc-400">
			{chartRange === 'day'
				? 'Nothing logged in this week. Try another week.'
				: 'Nothing to show for this range.'}
		</p>
	{:else}
		{#if shownLifts.length}
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">Lifts</h2>
				<ol class="space-y-3">
					{#each shownLifts as row (row.id)}
						<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
							<p class="text-lg font-semibold">{row.name}</p>
							<p class="mt-1 font-mono text-xl font-semibold">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-zinc-400">{row.bestLabel}</p>
							{#if row.points.length > 1}
								<svg
									class="mt-3 h-8 w-full text-lime-400"
									viewBox="0 0 100 32"
									preserveAspectRatio="none"
								>
									<polyline
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										points={spark(row.points)}
									/>
								</svg>
								{#if row.dates.length > 1}
									{@const marks = timelineMarks(row.dates)}
									<div class="mt-1 space-y-1">
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												<span
													class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
													style="left: {mark.left}%"
												>
													{mark.day}
												</span>
											{/each}
										</div>
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												{#if mark.month}
													<span
														class="absolute -translate-x-1/2 text-[10px] leading-none text-zinc-500"
														style="left: {mark.left}%"
													>
														{mark.month}
													</span>
												{/if}
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if shownCardio.length}
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">Cardio</h2>
				<ol class="space-y-3">
					{#each shownCardio as row (row.id)}
						<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
							<p class="text-lg font-semibold">{row.name}</p>
							<p class="mt-1 font-mono text-xl font-semibold">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-zinc-400">{row.bestLabel}</p>
							{#if row.points.length > 1}
								<svg
									class="mt-3 h-8 w-full text-lime-400"
									viewBox="0 0 100 32"
									preserveAspectRatio="none"
								>
									<polyline
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										points={spark(row.points)}
									/>
								</svg>
								{#if row.dates.length > 1}
									{@const marks = timelineMarks(row.dates)}
									<div class="mt-1 space-y-1">
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												<span
													class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
													style="left: {mark.left}%"
												>
													{mark.day}
												</span>
											{/each}
										</div>
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												{#if mark.month}
													<span
														class="absolute -translate-x-1/2 text-[10px] leading-none text-zinc-500"
														style="left: {mark.left}%"
													>
														{mark.month}
													</span>
												{/if}
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if shownStats.length}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">
					Body stats
				</h2>
				<ol class="space-y-3">
					{#each shownStats as row (row.id)}
						<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
							<p class="text-lg font-semibold">{row.name}</p>
							<p class="mt-1 font-mono text-xl font-semibold">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-zinc-400">{row.bestLabel}</p>
							{#if row.points.length > 1}
								<svg
									class="mt-3 h-8 w-full text-lime-400"
									viewBox="0 0 100 32"
									preserveAspectRatio="none"
								>
									<polyline
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										points={spark(row.points)}
									/>
								</svg>
								{#if row.dates.length > 1}
									{@const marks = timelineMarks(row.dates)}
									<div class="mt-1 space-y-1">
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												<span
													class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
													style="left: {mark.left}%"
												>
													{mark.day}
												</span>
											{/each}
										</div>
										<div class="relative h-3">
											{#each marks as mark (mark.key)}
												{#if mark.month}
													<span
														class="absolute -translate-x-1/2 text-[10px] leading-none text-zinc-500"
														style="left: {mark.left}%"
													>
														{mark.month}
													</span>
												{/if}
											{/each}
										</div>
									</div>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/if}
{/if}
