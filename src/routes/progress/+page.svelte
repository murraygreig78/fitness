<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import { formatNumber } from '$lib/format';
	import { formatDayHeading, dateForWeekday } from '$lib/week';
	import type { PlanDay } from '$lib/schema';

	const rows = $derived(
		fitness.progressSessions().flatMap((session) => {
			const day = fitness.plan?.days.find((item) => item.id === session.dayId);
			return session.stats
				.filter((stat) => stat.value != null)
				.map((stat) => ({
					session,
					day,
					stat,
					label: day
						? formatDayHeading(dateForWeekday(session.weekStart, day.weekday))
						: session.weekStart
				}));
		})
	);

	function statName(day: PlanDay | undefined, statId: string): string {
		const planned = day?.activities.find((item) => item.kind === 'progress');
		if (planned?.kind === 'progress') {
			const named = planned.stats.find((stat) => stat.id === statId)?.name;
			if (named) return named;
		}
		for (const custom of fitness.customActivities) {
			if (custom.activity.kind !== 'progress') continue;
			const named = custom.activity.stats.find((stat) => stat.id === statId)?.name;
			if (named) return named;
		}
		return statId;
	}
</script>

<header class="mb-6">
	<h1 class="text-2xl font-semibold">Body stats</h1>
	<p class="mt-1 text-sm leading-6 text-zinc-400">
		Weight, height, and other measures over time. Photos are stored as links, not image files.
	</p>
</header>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan that includes a progress activity.</p>
{:else if rows.length === 0}
	<p class="text-sm leading-6 text-zinc-400">
		No stats logged yet. Sunday includes a progress activity in the sample week.
	</p>
{:else}
	<ol class="space-y-3">
		{#each rows as row (row.session.id + row.stat.statId)}
			<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
				<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">{row.label}</p>
				<p class="mt-1 text-lg font-semibold">{statName(row.day, row.stat.statId)}</p>
				<p class="font-mono text-2xl">
					{formatNumber(row.stat.value)}
					<span class="text-base text-zinc-500">{row.stat.unit}</span>
				</p>
				{#if row.session.photoUrl}
					<a
						class="mt-2 inline-block text-sm text-lime-300"
						href={row.session.photoUrl}
						target="_blank"
						rel="noreferrer"
					>
						Open photo
					</a>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
