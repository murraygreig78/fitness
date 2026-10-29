<script lang="ts">
	import { activityKindLabel, type Plan } from '$lib/schema';
	import { targetPreview } from '$lib/metrics';
	import { weekdayLabel } from '$lib/week';

	let {
		plan,
		compact = false
	}: {
		plan: Plan;
		compact?: boolean;
	} = $props();
</script>

<ol class="space-y-3 {compact ? 'text-sm' : ''}">
	{#each plan.days as day (day.id)}
		<li class="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
			<p class="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
				{weekdayLabel(day.weekday, 'long')}
				{#if day.estimatedMinutes}
					· {day.estimatedMinutes} min
				{/if}
			</p>
			<p class="mt-1 font-semibold text-zinc-100">{day.name}</p>
			<ul class="mt-2 space-y-3">
				{#each day.activities as activity (activity.id)}
					<li>
						<p class="text-xs font-semibold tracking-[0.14em] text-lime-300 uppercase">
							{activityKindLabel(activity.kind)} · {activity.name}
						</p>
						{#if activity.kind === 'cardio'}
							<p class="mt-1 text-zinc-400">
								{#if activity.target.distanceKm != null}
									{activity.target.distanceKm} km
								{/if}
								{#if activity.target.durationSeconds != null}
									{#if activity.target.distanceKm != null}·{/if}
									{Math.round(activity.target.durationSeconds / 60)} min
								{/if}
							</p>
						{:else if activity.kind === 'progress'}
							<p class="mt-1 text-zinc-400">
								{activity.stats.map((stat) => stat.name).join(' · ')}
							</p>
						{:else}
							<ol class="mt-1 space-y-1">
								{#each activity.exercises as exercise (exercise.id)}
									<li class="flex items-baseline justify-between gap-3 text-zinc-300">
										<span class="min-w-0 truncate">{exercise.name}</span>
										<span class="shrink-0 font-mono text-xs text-zinc-500"
											>{targetPreview(exercise)}</span
										>
									</li>
								{/each}
							</ol>
						{/if}
					</li>
				{/each}
			</ul>
		</li>
	{/each}
</ol>
