<script lang="ts">
	import { kindDotClass } from '$lib/activity-style';
	import type { ActivityKind, Weekday } from '$lib/schema';
	import {
		calendarDays,
		dateForWeekday,
		isToday,
		parseDateOnly,
		weekdayLetter
	} from '$lib/week';

	let {
		weekStart,
		selected,
		kindsByWeekday,
		onSelect
	}: {
		weekStart: string;
		selected: Weekday;
		kindsByWeekday: Record<Weekday, ActivityKind[]>;
		onSelect: (weekday: Weekday) => void;
	} = $props();
</script>

<ol class="grid grid-cols-7 gap-1">
	{#each calendarDays as weekday (weekday)}
		{@const dateValue = dateForWeekday(weekStart, weekday)}
		{@const date = parseDateOnly(dateValue)}
		{@const today = isToday(dateValue)}
		{@const active = weekday === selected}
		<li>
			<button
				type="button"
				class="flex w-full flex-col items-center gap-1 rounded-2xl py-2 {active
					? 'bg-zinc-800'
					: today
						? 'ring-1 ring-zinc-600'
						: ''}"
				onclick={() => onSelect(weekday)}
				aria-pressed={active}
				aria-label={date.toLocaleDateString(undefined, {
					weekday: 'long',
					day: 'numeric',
					month: 'long'
				})}
			>
				<span class="text-[11px] font-medium tracking-wide {active ? 'text-zinc-300' : 'text-zinc-500'}">
					{weekdayLetter(weekday)}
				</span>
				<span
					class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold {active
						? 'bg-zinc-100 text-zinc-950'
						: 'text-zinc-100'}"
				>
					{date.getDate()}
				</span>
				<span class="flex h-2.5 items-center justify-center gap-0.5">
					{#each kindsByWeekday[weekday] as kind (kind)}
						<span class="h-1.5 w-1.5 rounded-full {kindDotClass(kind)}"></span>
					{/each}
				</span>
			</button>
		</li>
	{/each}
</ol>
