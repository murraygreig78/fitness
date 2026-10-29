<script lang="ts">
	import { onMount } from 'svelte';
	import { track } from '$lib/analytics';
	import { fitness } from '$lib/app-state.svelte';
	import TrendsOverlay, { type TrendSeries } from '$lib/components/TrendsOverlay.svelte';
	import { cardioTrends, exerciseTrends, statTrends } from '$lib/history';
	import { formatDistance, formatWeight } from '$lib/units';
	import { parseDateOnly } from '$lib/week';

	let query = $state('');

	onMount(() => {
		const hasPlan = Boolean(fitness.plan);
		const hasLogs = fitness.sessions.some((session) => session.completed || session.sets.length);
		track('activities_view', {
			has_plan: hasPlan,
			has_logs: hasLogs
		});
	});

	const lifts = $derived(
		exerciseTrends(fitness.plan, fitness.sessions, fitness.preferences.weightUnit)
	);
	const cardio = $derived(cardioTrends(fitness.sessions, fitness.preferences.distanceUnit));
	const stats = $derived(statTrends(fitness.plan, fitness.sessions));
	const empty = $derived(!lifts.length && !cardio.length && !stats.length);

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

	const shownLifts = $derived(filterRows(lifts));
	const shownCardio = $derived(filterRows(cardio));
	const shownStats = $derived(filterRows(stats));
	const noMatches = $derived(
		Boolean(needle) && !shownLifts.length && !shownCardio.length && !shownStats.length
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
					row.id === 'distance'
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
				labels: row.points.map((value) => `${value} ${row.unit}`.trim())
			});
		}
		return series.filter((item) => item.points.length > 1);
	});

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

	function formatSparkDate(date: string): string {
		return parseDateOnly(date).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short'
		});
	}

	function timelineMarks(dates: string[]): { date: string; label: string; left: number }[] {
		if (dates.length < 2) return [];
		const picks =
			dates.length <= 3
				? dates
				: [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates.at(-1)!];
		const unique = [...new Set(picks)];
		return unique.map((date, index) => ({
			date,
			label: formatSparkDate(date),
			left: unique.length === 1 ? 50 : (index / (unique.length - 1)) * 100
		}));
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
	<TrendsOverlay series={overlaySeries} />

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
									<div class="relative mt-1 h-4">
										{#each timelineMarks(row.dates) as mark (mark.date)}
											<span
												class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
												style="left: {mark.left}%"
											>
												{mark.label}
											</span>
										{/each}
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
									<div class="relative mt-1 h-4">
										{#each timelineMarks(row.dates) as mark (mark.date)}
											<span
												class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
												style="left: {mark.left}%"
											>
												{mark.label}
											</span>
										{/each}
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
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/if}
{/if}
