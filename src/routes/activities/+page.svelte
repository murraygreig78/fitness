<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import { cardioTrends, exerciseTrends, statTrends } from '$lib/history';

	let query = $state('');

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
							<p class="mt-1 font-mono text-2xl">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-lime-300">{row.bestLabel}</p>
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

		{#if shownCardio.length}
			<section class="mb-6">
				<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">Cardio</h2>
				<ol class="space-y-3">
					{#each shownCardio as row (row.id)}
						<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
							<p class="text-lg font-semibold">{row.name}</p>
							<p class="mt-1 font-mono text-2xl">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-lime-300">{row.bestLabel}</p>
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

		{#if shownStats.length}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">
					Body stats
				</h2>
				<ol class="space-y-3">
					{#each shownStats as row (row.id)}
						<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
							<p class="text-lg font-semibold">{row.name}</p>
							<p class="mt-1 font-mono text-2xl">{row.latestLabel}</p>
							<p class="mt-1 text-sm text-lime-300">{row.bestLabel}</p>
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
