<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import { cardioTrends, exerciseTrends, statTrends } from '$lib/history';

	const lifts = $derived(exerciseTrends(fitness.plan, fitness.sessions));
	const cardio = $derived(cardioTrends(fitness.sessions));
	const stats = $derived(statTrends(fitness.plan, fitness.sessions));
	const empty = $derived(!lifts.length && !cardio.length && !stats.length);

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
	{#if lifts.length}
		<section class="mb-6">
			<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">Lifts</h2>
			<ol class="space-y-3">
				{#each lifts as row (row.id)}
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

	{#if cardio.length}
		<section class="mb-6">
			<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">Cardio</h2>
			<ol class="space-y-3">
				{#each cardio as row (row.id)}
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

	{#if stats.length}
		<section>
			<h2 class="mb-3 text-sm font-semibold tracking-[0.16em] text-zinc-500 uppercase">
				Body stats
			</h2>
			<ol class="space-y-3">
				{#each stats as row (row.id)}
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
