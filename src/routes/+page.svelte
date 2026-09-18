<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { kindIconName, kindTextClass, statusIconName } from '$lib/activity-style';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindSheet from '$lib/components/KindSheet.svelte';
	import WeekCalendar from '$lib/components/WeekCalendar.svelte';
	import { activityPreview } from '$lib/metrics';
	import {
		createAdhocActivity,
		dayIdForWeekday,
		sessionStatus,
		uniqueActivityKinds,
		type Activity,
		type ActivityKind,
		type Weekday
	} from '$lib/schema';
	import {
		calendarDays,
		dateForWeekday,
		formatDayLong,
		formatMonthYear,
		isPlanWeekday,
		isSameWeek,
		isToday,
		normalizeWeekStart,
		shiftWeek,
		toDateOnly,
		weekdayFromDate
	} from '$lib/week';

	const weekFromUrl = $derived(page.url.searchParams.get('week'));
	const dayFromUrl = $derived(page.url.searchParams.get('day'));

	$effect(() => {
		if (weekFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(weekFromUrl)) {
			fitness.weekStart = normalizeWeekStart(weekFromUrl);
		}
	});

	let selected = $state<Weekday | null>(null);
	let picking = $state(false);

	const selectedWeekday = $derived.by(() => {
		if (selected) return selected;
		if (isPlanWeekday(dayFromUrl)) return dayFromUrl;
		if (isSameWeek(fitness.weekStart)) return weekdayFromDate(toDateOnly(new Date()));
		return 'sunday';
	});

	const selectedDate = $derived(dateForWeekday(fitness.weekStart, selectedWeekday));
	const selectedDayId = $derived(dayIdForWeekday(fitness.plan, selectedWeekday));
	const selectedActivities = $derived(
		fitness.activitiesForWeekday(selectedWeekday, fitness.weekStart)
	);

	const kindsByWeekday = $derived.by(() => {
		const map = {} as Record<Weekday, ActivityKind[]>;
		for (const weekday of calendarDays) {
			map[weekday] = uniqueActivityKinds(
				fitness.activitiesForWeekday(weekday, fitness.weekStart)
			);
		}
		return map;
	});

	function selectDay(weekday: Weekday) {
		selected = weekday;
	}

	function activityHref(activity: Activity): string {
		return resolve(`/session/${selectedDayId}/${activity.id}?week=${fitness.weekStart}`);
	}

	function statusFor(activity: Activity) {
		return sessionStatus(fitness.sessionFor(selectedDayId, activity.id, fitness.weekStart));
	}

	async function startUnscheduled(kind: ActivityKind) {
		if (!fitness.plan) {
			await goto(resolve('/plan'));
			return;
		}
		const activity = createAdhocActivity(kind);
		const record = await fitness.addCustomActivity(selectedWeekday, activity, fitness.weekStart);
		picking = false;
		await goto(resolve(`/session/${record.dayId}/${record.activity.id}?week=${fitness.weekStart}`));
	}
</script>

<header class="mb-5 flex items-center justify-between gap-3">
	<p class="text-lg font-semibold">{formatMonthYear(fitness.weekStart)}</p>
	<div class="flex items-center gap-1">
		<button
			type="button"
			class="rounded-full p-2 text-zinc-300"
			aria-label="Previous week"
			onclick={() => (fitness.weekStart = shiftWeek(fitness.weekStart, -1))}
		>
			<Icon name="chevronLeft" class="h-5 w-5" />
		</button>
		<button
			type="button"
			class="rounded-full p-2 text-zinc-300 disabled:opacity-30"
			aria-label="Next week"
			disabled={isSameWeek(fitness.weekStart)}
			onclick={() => (fitness.weekStart = shiftWeek(fitness.weekStart, 1))}
		>
			<Icon name="chevronRight" class="h-5 w-5" />
		</button>
	</div>
</header>

<WeekCalendar
	weekStart={fitness.weekStart}
	selected={selectedWeekday}
	{kindsByWeekday}
	onSelect={selectDay}
/>

{#if !fitness.plan}
	<section class="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
		<p class="text-sm leading-6 text-zinc-400">
			Load a weekly plan once. Scheduled work shows as colored dots; plus starts something extra.
		</p>
		<a
			href={resolve('/plan')}
			class="mt-4 inline-flex rounded-full bg-lime-400 px-4 py-2 text-sm font-semibold text-zinc-950"
		>
			Open admin
		</a>
	</section>
{:else}
	<div class="mt-6 mb-4 flex items-center justify-between gap-3">
		<div>
			<p class="text-lg font-semibold">{formatDayLong(selectedDate)}</p>
			{#if isToday(selectedDate)}
				<p class="text-sm text-zinc-500">Today</p>
			{/if}
		</div>
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-950"
			aria-label="Start unscheduled activity"
			onclick={() => (picking = true)}
		>
			<Icon name="plus" class="h-5 w-5" />
		</button>
	</div>

	{#if selectedActivities.length === 0}
		<p class="text-sm leading-6 text-zinc-500">Nothing scheduled. Use plus to log something.</p>
	{:else}
		<ol class="space-y-2">
			{#each selectedActivities as activity (activity.id)}
				{@const status = statusFor(activity)}
				<li>
					<a
						href={activityHref(activity)}
						class="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-3"
					>
						<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 {kindTextClass(activity.kind)}">
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
{/if}

{#if picking}
	<KindSheet onPick={startUnscheduled} onClose={() => (picking = false)} />
{/if}
