<script lang="ts">
	import { page } from '$app/state';
	import { fitness } from '$lib/app-state.svelte';
	import { dayStatus, summarizeActivities, weekdays, type PlanDay } from '$lib/schema';
	import {
		dateForWeekday,
		formatDayHeading,
		formatWeekRange,
		isSameWeek,
		isToday,
		shiftWeek
	} from '$lib/week';

	const weekFromUrl = $derived(page.url.searchParams.get('week'));

	$effect(() => {
		if (weekFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(weekFromUrl)) {
			fitness.weekStart = weekFromUrl;
		}
	});

	function dayFor(weekday: (typeof weekdays)[number]): PlanDay | undefined {
		return fitness.plan?.days.find((day) => day.weekday === weekday);
	}

	function statusLabel(weekday: (typeof weekdays)[number]): string {
		const day = dayFor(weekday);
		if (!day) return 'Rest';
		const status = dayStatus(day, fitness.sessionsForDay(day.id));
		if (status === 'done') return 'Done';
		if (status === 'skipped') return 'Skipped';
		if (status === 'in-progress') return 'In progress';
		return 'Scheduled';
	}
</script>

<header class="mb-6 flex items-center justify-between gap-3">
	<div>
		<p class="text-xs font-semibold tracking-[0.22em] text-lime-300 uppercase">This week</p>
		<h1 class="text-2xl font-bold">{formatWeekRange(fitness.weekStart)}</h1>
	</div>
	<div class="flex gap-2">
		<button
			type="button"
			class="rounded-full border border-zinc-700 px-3 py-2 text-sm"
			onclick={() => (fitness.weekStart = shiftWeek(fitness.weekStart, -1))}
		>
			Prev
		</button>
		<button
			type="button"
			class="rounded-full border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40"
			disabled={isSameWeek(fitness.weekStart)}
			onclick={() => (fitness.weekStart = shiftWeek(fitness.weekStart, 1))}
		>
			Next
		</button>
	</div>
</header>

{#if !fitness.plan}
	<section class="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="text-lg font-semibold">Import a weekly plan</h2>
		<p class="mt-2 text-sm leading-6 text-zinc-400">
			Load a JSON template once. Days contain activities — cardio, strength, mobility, or progress.
		</p>
		<a
			href="/plan"
			class="mt-4 inline-flex rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-zinc-950"
		>
			Open plan import
		</a>
	</section>
{:else}
	<p class="mb-4 text-sm text-zinc-400">{fitness.plan.name}</p>
	<ol class="space-y-3">
		{#each weekdays as weekday (weekday)}
			{@const day = dayFor(weekday)}
			{@const dateValue = dateForWeekday(fitness.weekStart, weekday)}
			<li>
				{#if day}
					<a
						href="/session/{day.id}?week={fitness.weekStart}"
						class="block rounded-3xl border p-4 {isToday(dateValue)
							? 'border-lime-400 bg-zinc-900'
							: 'border-zinc-800 bg-zinc-900/70'}"
					>
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
									{formatDayHeading(dateValue)}
								</p>
								<h2 class="mt-1 text-lg font-semibold">{day.name}</h2>
								<p class="mt-1 text-sm text-zinc-400">{summarizeActivities(day.activities)}</p>
							</div>
							<span
								class="rounded-full px-3 py-1 text-xs font-semibold {statusLabel(weekday) === 'Done'
									? 'bg-lime-400/15 text-lime-300'
									: statusLabel(weekday) === 'In progress'
										? 'bg-orange-400/15 text-orange-300'
										: 'bg-zinc-800 text-zinc-300'}"
							>
								{statusLabel(weekday)}
							</span>
						</div>
					</a>
				{:else}
					<div class="rounded-3xl border border-dashed border-zinc-800 px-4 py-4 text-zinc-500">
						<p class="text-xs font-semibold tracking-[0.18em] uppercase">
							{formatDayHeading(dateValue)}
						</p>
						<p class="mt-1 text-sm">Rest</p>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
