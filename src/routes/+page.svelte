<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { kindIconName, kindTextClass, statusIconName } from '$lib/activity-style';
	import { fitness } from '$lib/app-state.svelte';
	import ActivityMenu from '$lib/components/ActivityMenu.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import KindSheet from '$lib/components/KindSheet.svelte';
	import WeekCalendar from '$lib/components/WeekCalendar.svelte';
	import SamplePlanList from '$lib/components/SamplePlanList.svelte';
	import { starterPlans } from '$lib/samples';
	import { activityPreview } from '$lib/metrics';
	import {
		cloneActivityAsAdhoc,
		createAdhocActivity,
		dayIdForWeekday,
		isAdhocActivityId,
		sessionDay,
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
	let menuActivity = $state<Activity | null>(null);
	let planBusy = $state(false);
	let planError = $state<string | null>(null);
	let pressTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressClick = $state(false);

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
			map[weekday] = uniqueActivityKinds(fitness.activitiesForWeekday(weekday, fitness.weekStart));
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

	function canRemove(activity: Activity) {
		return isAdhocActivityId(activity.id) || Boolean(fitness.customActivity(activity.id));
	}

	function clearPressTimer() {
		if (pressTimer) clearTimeout(pressTimer);
		pressTimer = undefined;
	}

	function openMenu(activity: Activity) {
		clearPressTimer();
		suppressClick = true;
		menuActivity = activity;
	}

	function onActivityPointerDown(activity: Activity) {
		clearPressTimer();
		pressTimer = setTimeout(() => openMenu(activity), 450);
	}

	function onActivityClick(event: MouseEvent, activity: Activity) {
		if (suppressClick) {
			event.preventDefault();
			suppressClick = false;
		}
	}

	async function startBlank(kind: ActivityKind) {
		if (!fitness.plan) return;
		const activity = createAdhocActivity(kind);
		const record = await fitness.addCustomActivity(selectedWeekday, activity, fitness.weekStart);
		picking = false;
		await goto(resolve(`/session/${record.dayId}/${record.activity.id}?week=${fitness.weekStart}`));
	}

	async function startFromPlan(source: Activity) {
		if (!fitness.plan) return;
		const activity = cloneActivityAsAdhoc(source);
		const record = await fitness.addCustomActivity(selectedWeekday, activity, fitness.weekStart);
		picking = false;
		await goto(resolve(`/session/${record.dayId}/${record.activity.id}?week=${fitness.weekStart}`));
	}

	async function skipMenuActivity() {
		const activity = menuActivity;
		menuActivity = null;
		if (!activity || !fitness.plan) return;
		const day = sessionDay(fitness.plan, selectedWeekday, selectedDayId, activity);
		await fitness.skipSession(day, activity, fitness.weekStart);
	}

	async function unskipMenuActivity() {
		const activity = menuActivity;
		menuActivity = null;
		if (!activity || !fitness.plan) return;
		const day = sessionDay(fitness.plan, selectedWeekday, selectedDayId, activity);
		await fitness.unskipSession(day, activity, fitness.weekStart);
	}

	async function removeMenuActivity() {
		const activity = menuActivity;
		menuActivity = null;
		if (!activity) return;
		await fitness.removeCustomActivity(activity.id, fitness.weekStart);
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
		<section class="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
			<h2 class="text-lg font-semibold">Load a weekly plan</h2>
			<p class="mt-1 text-sm leading-6 text-zinc-400">
				Pick a starter week below, or
				<a class="text-lime-300 underline" href={resolve('/plan')}>import JSON in Admin</a>.
			</p>
			<div class="mt-4">
				<SamplePlanList plans={starterPlans} bind:busy={planBusy} bind:error={planError} />
			</div>
		</section>
	{/if}

	<div class="mt-6 mb-4 flex items-center justify-between gap-3">
		<div>
			<p class="text-lg font-semibold">{formatDayLong(selectedDate)}</p>
			{#if isToday(selectedDate)}
				<p class="text-sm text-zinc-500">Today</p>
			{/if}
		</div>
		<button
			type="button"
			class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 disabled:opacity-30"
			aria-label="Start unscheduled activity"
			disabled={!fitness.plan}
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
						class="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-3 {status ===
						'skipped'
							? 'opacity-60'
							: ''}"
						onpointerdown={() => onActivityPointerDown(activity)}
						onpointerup={clearPressTimer}
						onpointercancel={clearPressTimer}
						onpointerleave={clearPressTimer}
						oncontextmenu={(event) => {
							event.preventDefault();
							openMenu(activity);
						}}
						onclick={(event) => onActivityClick(event, activity)}
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
							<span class="block truncate text-sm text-zinc-500">
								{status === 'skipped' ? 'Skipped' : activityPreview(activity)}
							</span>
						</span>
						<span class="text-zinc-500">
							<Icon name={statusIconName(status)} class="h-5 w-5" />
						</span>
					</a>
				</li>
			{/each}
		</ol>
	{/if}

{#if picking}
	<KindSheet
		plan={fitness.plan}
		onPickKind={startBlank}
		onPickPlanActivity={startFromPlan}
		onClose={() => (picking = false)}
	/>
{/if}

{#if menuActivity}
	{@const activity = menuActivity}
	<ActivityMenu
		title={activity.name}
		canRemove={canRemove(activity)}
		skipped={statusFor(activity) === 'skipped'}
		onSkip={() => void skipMenuActivity()}
		onUnskip={() => void unskipMenuActivity()}
		onRemove={() => void removeMenuActivity()}
		onClose={() => (menuActivity = null)}
	/>
{/if}
