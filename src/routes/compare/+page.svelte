<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import { formatDuration, formatKg, formatNumber } from '$lib/format';
	import { deltaText, metricsForDay, sumMetrics } from '$lib/metrics';
	import { formatWeekRange, shiftWeek } from '$lib/week';

	const lastWeek = $derived(shiftWeek(fitness.weekStart, -1));
	const rows = $derived(
		(fitness.plan?.days ?? []).map((day) => {
			const current = metricsForDay(day, fitness.sessionFor(day.id, fitness.weekStart));
			const previous = metricsForDay(day, fitness.sessionFor(day.id, lastWeek));
			return { day, current, previous };
		})
	);
	const totals = $derived({
		current: sumMetrics(rows.map((row) => row.current)),
		previous: sumMetrics(rows.map((row) => row.previous))
	});
</script>

<header class="mb-6">
	<p class="text-xs font-semibold tracking-[0.22em] text-lime-300 uppercase">Compare</p>
	<h1 class="text-2xl font-bold">This week vs last week</h1>
	<p class="mt-1 text-sm text-zinc-400">
		{formatWeekRange(fitness.weekStart)} against {formatWeekRange(lastWeek)}
	</p>
</header>

{#if !fitness.plan}
	<p class="text-sm text-zinc-400">Import a plan to compare weeks.</p>
{:else}
	<section class="mb-5 grid grid-cols-2 gap-3">
		<div class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Volume</p>
			<p class="mt-1 font-mono text-2xl font-semibold">{formatKg(totals.current.volumeKg)} kg</p>
			<p class="text-sm text-zinc-400">
				{deltaText(totals.current.volumeKg, totals.previous.volumeKg, (value) => `${formatKg(value)} kg`)}
			</p>
		</div>
		<div class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Sets</p>
			<p class="mt-1 font-mono text-2xl font-semibold">
				{totals.current.setsCompleted}/{totals.current.setsPlanned}
			</p>
			<p class="text-sm text-zinc-400">
				{deltaText(totals.current.setsCompleted, totals.previous.setsCompleted, String)}
			</p>
		</div>
		<div class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Cardio</p>
			<p class="mt-1 font-mono text-2xl font-semibold">
				{formatNumber(totals.current.cardioKm)} km
			</p>
			<p class="text-sm text-zinc-400">{formatDuration(totals.current.cardioSeconds)}</p>
		</div>
		<div class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Session time</p>
			<p class="mt-1 font-mono text-2xl font-semibold">
				{formatDuration(totals.current.sessionSeconds ?? undefined)}
			</p>
			<p class="text-sm text-zinc-400">
				{deltaText(
					totals.current.sessionSeconds ?? 0,
					totals.previous.sessionSeconds ?? 0,
					formatDuration
				)}
			</p>
		</div>
	</section>

	<ol class="space-y-3">
		{#each rows as row (row.day.id)}
			<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="font-semibold">{row.day.name}</h2>
					<a class="text-sm text-lime-300" href="/session/{row.day.id}?week={fitness.weekStart}">
						Open
					</a>
				</div>
				<dl class="grid grid-cols-2 gap-2 text-sm">
					<div>
						<dt class="text-zinc-500">Sets</dt>
						<dd class="font-mono">
							{row.current.setsCompleted}/{row.current.setsPlanned}
							<span class="text-zinc-500">
								vs {row.previous.setsCompleted}/{row.previous.setsPlanned}
							</span>
						</dd>
					</div>
					<div>
						<dt class="text-zinc-500">Volume</dt>
						<dd class="font-mono">
							{formatKg(row.current.volumeKg)} kg
							<span class="text-zinc-500">vs {formatKg(row.previous.volumeKg)} kg</span>
						</dd>
					</div>
					<div>
						<dt class="text-zinc-500">Cardio</dt>
						<dd class="font-mono">
							{formatNumber(row.current.cardioKm)} km · {formatDuration(row.current.cardioSeconds)}
						</dd>
					</div>
					<div>
						<dt class="text-zinc-500">Session</dt>
						<dd class="font-mono">
							{formatDuration(row.current.sessionSeconds ?? undefined)}
							<span class="text-zinc-500">
								vs {formatDuration(row.previous.sessionSeconds ?? undefined)}
							</span>
						</dd>
					</div>
				</dl>
			</li>
		{/each}
	</ol>
{/if}
