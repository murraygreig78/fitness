<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fitness } from '$lib/app-state.svelte';
	import { activityPreview } from '$lib/metrics';
	import {
		activityKindLabel,
		sessionStatus,
		type Activity
	} from '$lib/schema';
	import { dateForWeekday, formatDayHeading, mondayOf } from '$lib/week';

	const dayId = $derived(page.params.dayId ?? '');
	const weekStart = $derived(page.url.searchParams.get('week') || fitness.weekStart || mondayOf());
	const day = $derived(fitness.plan?.days.find((item) => item.id === dayId));

	function statusFor(activity: Activity) {
		return sessionStatus(fitness.sessionFor(dayId, activity.id, weekStart));
	}
</script>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan first.</p>
	<a class="mt-3 inline-block text-lime-300" href="/plan">Go to plan</a>
{:else if !day}
	<p class="text-sm text-zinc-400">That day is not in the current plan.</p>
	<button type="button" class="mt-3 text-lime-300" onclick={() => goto('/')}>Back to week</button>
{:else}
	<header class="mb-5">
		<a href="/" class="text-sm text-zinc-400">← Week</a>
		<p class="mt-2 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
			{formatDayHeading(dateForWeekday(weekStart, day.weekday))}
		</p>
		<h1 class="text-2xl font-bold">{day.name}</h1>
		<p class="mt-1 text-sm text-zinc-400">{day.activities.length} scheduled activities</p>
	</header>

	<ol class="space-y-3">
		{#each day.activities as activity (activity.id)}
			{@const status = statusFor(activity)}
			<li>
				<a
					href="/session/{day.id}/{activity.id}?week={weekStart}"
					class="block rounded-3xl border border-zinc-800 bg-zinc-900 p-4"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold tracking-[0.18em] text-lime-300 uppercase">
								{activityKindLabel(activity.kind)}
							</p>
							<h2 class="mt-1 text-lg font-semibold">{activity.name}</h2>
							<p class="mt-1 text-sm text-zinc-400">{activityPreview(activity)}</p>
						</div>
						<span
							class="rounded-full px-3 py-1 text-xs font-semibold {status === 'done'
								? 'bg-lime-400/15 text-lime-300'
								: status === 'in-progress'
									? 'bg-orange-400/15 text-orange-300'
									: 'bg-zinc-800 text-zinc-300'}"
						>
							{status === 'upcoming' ? 'Log' : status}
						</span>
					</div>
				</a>
			</li>
		{/each}
	</ol>
{/if}
