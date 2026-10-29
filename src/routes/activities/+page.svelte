<script lang="ts">
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TrendsOverlay, { type TrendSeries } from '$lib/components/TrendsOverlay.svelte';
	import {
		cardioTrends,
		exerciseTrends,
		rollingSevenDayComparison,
		statTrends,
		type TrendGrain
	} from '$lib/history';
	import {
		dayIdForWeekday,
		freeDayId
	} from '$lib/schema';
	import {
		formatDistance,
		formatWeight,
		kgToDisplay,
		weightUnitLabel
	} from '$lib/units';
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

	const sevenDayCompare = $derived(
		rollingSevenDayComparison(fitness.sessions, dayIndexById)
	);

	const compareRows = $derived.by(() => {
		const weightUnit = fitness.preferences.weightUnit;
		const distanceUnit = fitness.preferences.distanceUnit;
		const { current, previous } = sevenDayCompare;

		function delta(currentValue: number, previousValue: number) {
			const diff = currentValue - previousValue;
			if (diff === 0) return { text: 'Same', tone: 'flat' as const };
			const sign = diff > 0 ? '+' : '−';
			const abs = Math.abs(diff);
			const pct =
				previousValue > 0 ? Math.round((Math.abs(diff) / previousValue) * 100) : null;
			return {
				text: pct == null ? `${sign}${abs}` : `${sign}${pct}%`,
				tone: (diff > 0 ? 'up' : 'down') as 'up' | 'down'
			};
		}

		const volume = (kg: number) =>
			`${Math.round(kgToDisplay(kg, weightUnit)).toLocaleString()} ${weightUnitLabel(weightUnit)}·reps`;

		return [
			{
				id: 'activities',
				label: 'Activities',
				current: String(current.activities),
				delta: delta(current.activities, previous.activities)
			},
			{
				id: 'volume',
				label: 'Kg lifted',
				current: volume(current.volumeKg),
				delta: delta(current.volumeKg, previous.volumeKg)
			},
			{
				id: 'distance',
				label: 'Distance',
				current: formatDistance(current.distanceKm, distanceUnit),
				delta: delta(current.distanceKm, previous.distanceKm)
			}
		];
	});

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
						? formatWeight(best, weightUnit)
						: `${best} reps`
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
					bestLabel: label(best),
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
					bestLabel: `${best} ${row.unit}`.trim(),
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

	function sparkPoints(
		points: number[],
		dates: string[],
		domain: string[] | null
	): { x: number; y: number }[] {
		if (!points.length) return [];
		const axis = domain?.length ? domain : dates;
		if (!axis.length) return [];
		const min = Math.min(...points);
		const max = Math.max(...points);
		const span = max - min || 1;
		const axisIndex = new Map(axis.map((date, index) => [date, index]));
		const plotted: { x: number; y: number }[] = [];
		for (let index = 0; index < points.length; index += 1) {
			const date = dates[index]!;
			const slot = axisIndex.get(date) ?? index;
			const x = axis.length === 1 ? 50 : (slot / (axis.length - 1)) * 100;
			const y = 28 - ((points[index]! - min) / span) * 24;
			plotted.push({ x, y });
		}
		return plotted;
	}

	function spark(points: number[], dates: string[], domain: string[] | null): string {
		const plotted = sparkPoints(points, dates, domain);
		if (plotted.length < 2) return '';
		return plotted.map((point) => `${point.x},${point.y}`).join(' ');
	}

	function timelineMarks(
		dates: string[],
		domain: string[] | null = null
	): { key: string; day: string; month: string | null; left: number }[] {
		const axis = domain?.length ? domain : dates;
		if (!axis.length) return [];
		// Week view with a single point still needs no axis; day view always shows the week.
		if (!domain && axis.length < 2) return [];
		return axis.map((date, index) => {
			const parsed = parseDateOnly(date);
			const monthKey = `${parsed.getFullYear()}-${parsed.getMonth()}`;
			const previous = index > 0 ? parseDateOnly(axis[index - 1]!) : null;
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
				left: axis.length === 1 ? 50 : (index / (axis.length - 1)) * 100
			};
		});
	}

	function listDomain(): string[] | null {
		return chartRange === 'day' ? dayDomain : null;
	}

	function showListGraph(row: ListRow): boolean {
		return chartRange === 'day' ? row.points.length > 0 : row.points.length > 1;
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
	<div class="mb-3 flex items-center gap-3 whitespace-nowrap">
		<div class="flex shrink-0 items-center gap-2 text-sm">
			<button
				type="button"
				class="font-medium {chartRange === 'week' ? 'text-lime-400' : 'text-zinc-500'}"
				onclick={() => setChartRange('week')}
			>
				Week
			</button>
			<button
				type="button"
				class="font-medium {chartRange === 'day' ? 'text-lime-400' : 'text-zinc-500'}"
				onclick={() => setChartRange('day')}
			>
				Day
			</button>
		</div>

		{#if chartRange === 'day'}
			<div class="ml-auto flex min-w-0 items-center gap-1">
				<button
					type="button"
					class="rounded-lg p-1 text-zinc-300 disabled:opacity-30"
					aria-label="Previous week"
					disabled={!canPrevWeek}
					onclick={() => (focusWeekStart = shiftWeek(focusWeekStart, -1))}
				>
					<Icon name="chevronLeft" class="h-4 w-4" />
				</button>
				<p class="min-w-0 flex-1 truncate text-center text-sm text-zinc-300">
					{formatWeekRange(focusWeekStart)}
				</p>
				<button
					type="button"
					class="rounded-lg p-1 text-zinc-300 disabled:opacity-30"
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

	<section class="mb-6">
		<p class="mb-2 text-sm text-zinc-500">Last 7 days</p>
		<ul class="flex gap-2 overflow-x-auto">
			{#each compareRows as row (row.id)}
				<li class="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3">
					<p class="truncate text-xs text-zinc-500">{row.label}</p>
					<p class="mt-1 truncate font-mono text-sm font-semibold">{row.current}</p>
					<p
						class="mt-1 text-xs font-semibold {row.delta.tone === 'up'
							? 'text-lime-300'
							: row.delta.tone === 'down'
								? 'text-orange-300'
								: 'text-zinc-500'}"
					>
						{row.delta.text}
					</p>
				</li>
			{/each}
		</ul>
	</section>

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
							<p class="mt-1 font-mono text-xl font-semibold">
								{row.latestLabel}
								{' '}
								<span class="text-zinc-400">({row.bestLabel})</span>
							</p>
							{#if showListGraph(row)}
								{@const domain = listDomain()}
								{@const plotted = sparkPoints(row.points, row.dates, domain)}
								{@const line = spark(row.points, row.dates, domain)}
								{@const marks = timelineMarks(row.dates, domain)}
								<!-- Line uses preserveAspectRatio=none so it fills width; dots are HTML so they stay round. -->
								<div class="relative mt-3 h-8 w-full text-lime-400">
									<svg
										class="absolute inset-0 h-full w-full"
										viewBox="0 0 100 32"
										preserveAspectRatio="none"
									>
										{#if line}
											<polyline
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												vector-effect="non-scaling-stroke"
												stroke-linecap="round"
												stroke-linejoin="round"
												points={line}
											/>
										{/if}
									</svg>
									{#each plotted as point, index (`${row.id}:${index}`)}
										<span
											class="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
											style="left: {point.x}%; top: {(point.y / 32) * 100}%"
										></span>
									{/each}
								</div>
								{#if marks.length}
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
							<p class="mt-1 font-mono text-xl font-semibold">
								{row.latestLabel}
								{' '}
								<span class="text-zinc-400">({row.bestLabel})</span>
							</p>
							{#if showListGraph(row)}
								{@const domain = listDomain()}
								{@const plotted = sparkPoints(row.points, row.dates, domain)}
								{@const line = spark(row.points, row.dates, domain)}
								{@const marks = timelineMarks(row.dates, domain)}
								<div class="relative mt-3 h-8 w-full text-lime-400">
									<svg
										class="absolute inset-0 h-full w-full"
										viewBox="0 0 100 32"
										preserveAspectRatio="none"
									>
										{#if line}
											<polyline
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												vector-effect="non-scaling-stroke"
												stroke-linecap="round"
												stroke-linejoin="round"
												points={line}
											/>
										{/if}
									</svg>
									{#each plotted as point, index (`${row.id}:${index}`)}
										<span
											class="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
											style="left: {point.x}%; top: {(point.y / 32) * 100}%"
										></span>
									{/each}
								</div>
								{#if marks.length}
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
							<p class="mt-1 font-mono text-xl font-semibold">
								{row.latestLabel}
								{' '}
								<span class="text-zinc-400">({row.bestLabel})</span>
							</p>
							{#if showListGraph(row)}
								{@const domain = listDomain()}
								{@const plotted = sparkPoints(row.points, row.dates, domain)}
								{@const line = spark(row.points, row.dates, domain)}
								{@const marks = timelineMarks(row.dates, domain)}
								<div class="relative mt-3 h-8 w-full text-lime-400">
									<svg
										class="absolute inset-0 h-full w-full"
										viewBox="0 0 100 32"
										preserveAspectRatio="none"
									>
										{#if line}
											<polyline
												fill="none"
												stroke="currentColor"
												stroke-width="1.5"
												vector-effect="non-scaling-stroke"
												stroke-linecap="round"
												stroke-linejoin="round"
												points={line}
											/>
										{/if}
									</svg>
									{#each plotted as point, index (`${row.id}:${index}`)}
										<span
											class="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
											style="left: {point.x}%; top: {(point.y / 32) * 100}%"
										></span>
									{/each}
								</div>
								{#if marks.length}
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
