<script lang="ts">
	import { formatDuration, formatKg, formatNumber } from '$lib/format';
	import { fieldsForExercise, findSet, previousStatValue } from '$lib/previous';
	import type { Activity, Exercise, Session } from '$lib/schema';

	let {
		activity,
		last,
		weekdayLabel
	}: {
		activity: Activity;
		last: Session | undefined;
		weekdayLabel: string;
	} = $props();

	function lastSetLine(exercise: Exercise): string {
		if (!last) return '—';
		const completed = last.sets
			.filter((set) => set.exerciseId === exercise.id && set.completed && !set.warmup)
			.sort((a, b) => b.setIndex - a.setIndex)[0];
		const logged = completed ?? findSet(last.sets, exercise.id, 0);
		if (!logged) return '—';
		return fieldsForExercise(exercise)
			.map((field) => {
				if (field === 'kg') return `${formatKg(logged.kg)} kg`;
				if (field === 'reps') return `${formatNumber(logged.reps, 0)} reps`;
				return formatDuration(logged.durationSeconds);
			})
			.join(' · ');
	}
</script>

{#if last}
	{@const previous = last}
	<section class="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
		<p class="text-xs text-zinc-500">Last time · {weekdayLabel}</p>
		{#if activity.kind === 'cardio'}
			<p class="mt-1 font-mono text-sm text-zinc-200">
				{formatNumber(previous.distanceKm)} km · {formatDuration(previous.durationSeconds)}
			</p>
		{:else if activity.kind === 'progress'}
			<p class="mt-1 font-mono text-sm text-zinc-200">
				{activity.stats
					.map((stat) => {
						const value = previousStatValue([previous], stat.id, stat.unit);
						return `${stat.name} ${formatNumber(value)} ${stat.unit}`;
					})
					.join(' · ')}
			</p>
		{:else}
			<ul class="mt-2 space-y-1">
				{#each activity.kind === 'strength' || activity.kind === 'mobility' ? activity.exercises : [] as exercise (exercise.id)}
					<li class="flex items-baseline justify-between gap-3 text-sm">
						<span class="truncate text-zinc-400">{exercise.name}</span>
						<span class="shrink-0 font-mono text-zinc-200">{lastSetLine(exercise)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
