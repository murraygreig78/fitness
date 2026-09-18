<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { kindIconName, kindTextClass, statusIconName } from '$lib/activity-style';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { activityPreview } from '$lib/metrics';
	import { sessionStatus, type Activity } from '$lib/schema';
	import { dateForWeekday, formatDayLong, normalizeWeekStart, sundayOf } from '$lib/week';

	const dayId = $derived(page.params.dayId ?? '');
	const weekStart = $derived(
		normalizeWeekStart(page.url.searchParams.get('week') || fitness.weekStart || sundayOf())
	);
	const day = $derived(fitness.plan?.days.find((item) => item.id === dayId));
	const extras = $derived(fitness.customActivitiesForDay(dayId, weekStart));
	const activities = $derived([...(day?.activities ?? []), ...extras]);

	function statusFor(activity: Activity) {
		return sessionStatus(fitness.sessionFor(dayId, activity.id, weekStart));
	}
</script>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan first.</p>
	<a class="mt-3 inline-block text-lime-300" href={resolve('/plan')}>Go to plan</a>
{:else if !day && activities.length === 0}
	<p class="text-sm text-zinc-400">That day is not in the current plan.</p>
	<button type="button" class="mt-3 text-lime-300" onclick={() => goto(resolve('/'))}>Back to week</button>
{:else}
	<header class="mb-5">
		<a href={resolve(`/?week=${weekStart}`)} class="inline-flex text-zinc-400" aria-label="Back to week">
			<Icon name="back" class="h-5 w-5" />
		</a>
		<p class="mt-3 text-lg font-semibold">
			{day ? formatDayLong(dateForWeekday(weekStart, day.weekday)) : 'Open day'}
		</p>
	</header>

	<ol class="space-y-2">
		{#each activities as activity (activity.id)}
			{@const status = statusFor(activity)}
			<li>
				<a
					href={resolve(`/session/${dayId}/${activity.id}?week=${weekStart}`)}
					class="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-3"
				>
					<span
						class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 {kindTextClass(
							activity.kind
						)}"
					>
						<Icon name={kindIconName(activity.kind)} class="h-5 w-5" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{activity.name}</span>
						<span class="block truncate text-sm text-zinc-500">{activityPreview(activity)}</span>
					</span>
					<span class="text-zinc-500">
						<Icon name={statusIconName(status)} class="h-5 w-5" />
					</span>
				</a>
			</li>
		{/each}
	</ol>
{/if}
