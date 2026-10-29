<script lang="ts">
	import { asset } from '$app/paths';
	import { fitness } from '$lib/app-state.svelte';
	import PlanOutline from '$lib/components/PlanOutline.svelte';
	import {
		filterStarterPlans,
		importSampleFromUrl,
		type SamplePlanInfo,
		type StarterDaysFilter,
		type StarterEquipmentFilter
	} from '$lib/samples';
	import { parsePlanJson, type Plan } from '$lib/schema';

	let {
		plans,
		variant = 'primary',
		busy = $bindable(false),
		error = $bindable<string | null>(null),
		onLoaded
	}: {
		plans: SamplePlanInfo[];
		variant?: 'primary' | 'secondary';
		busy?: boolean;
		error?: string | null;
		onLoaded?: (mode: 'replace' | 'merge', plan: SamplePlanInfo) => void;
	} = $props();

	let equipment = $state<StarterEquipmentFilter>('all');
	let days = $state<StarterDaysFilter>('all');
	let expandedId = $state<string | null>(null);
	let outlines = $state<Record<string, Plan>>({});
	let outlineError = $state<Record<string, string>>({});
	let outlineLoading = $state<string | null>(null);

	const visible = $derived(filterStarterPlans(plans, equipment, days));
	const canMerge = $derived(Boolean(fitness.plan));

	async function load(plan: SamplePlanInfo, mode: 'replace' | 'merge') {
		busy = true;
		error = null;
		try {
			await importSampleFromUrl(asset(plan.file), mode);
			onLoaded?.(mode, plan);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not load sample';
		} finally {
			busy = false;
		}
	}

	async function toggleOutline(plan: SamplePlanInfo) {
		if (expandedId === plan.id) {
			expandedId = null;
			return;
		}
		expandedId = plan.id;
		if (outlines[plan.id] || outlineError[plan.id]) return;
		outlineLoading = plan.id;
		try {
			const response = await fetch(asset(plan.file));
			if (!response.ok) throw new Error('Could not open that plan');
			const parsed = parsePlanJson(await response.json());
			if ('error' in parsed) throw new Error(parsed.error);
			outlines = { ...outlines, [plan.id]: parsed.plan };
		} catch (caught) {
			outlineError = {
				...outlineError,
				[plan.id]: caught instanceof Error ? caught.message : 'Could not preview plan'
			};
		} finally {
			outlineLoading = null;
		}
	}
</script>

<div class="mb-4 space-y-3">
	<div>
		<p class="mb-2 text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">Equipment</p>
		<div class="flex flex-wrap gap-2">
			{#each [{ id: 'all', label: 'All' }, { id: 'bodyweight', label: 'Bodyweight' }, { id: 'dumbbell', label: 'Dumbbell' }] as option (option.id)}
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-xs font-semibold {equipment === option.id
						? 'bg-lime-400 text-zinc-950'
						: 'border border-zinc-700 text-zinc-300'}"
					onclick={() => (equipment = option.id as StarterEquipmentFilter)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
	<div>
		<p class="mb-2 text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">Days / week</p>
		<div class="flex flex-wrap gap-2">
			{#each [{ id: 'all', label: 'All' }, { id: 2, label: '2' }, { id: 3, label: '3' }, { id: 4, label: '4' }, { id: 6, label: '6' }, { id: 7, label: '7' }] as option (String(option.id))}
				<button
					type="button"
					class="rounded-full px-3 py-1.5 text-xs font-semibold {days === option.id
						? 'bg-lime-400 text-zinc-950'
						: 'border border-zinc-700 text-zinc-300'}"
					onclick={() => (days = option.id as StarterDaysFilter)}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>
</div>

{#if visible.length === 0}
	<p class="text-sm leading-6 text-zinc-400">No starter plans match those filters.</p>
{:else}
	<ul class="space-y-3">
		{#each visible as plan (plan.id)}
			<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
				<p class="text-xs font-semibold tracking-[0.16em] text-lime-300 uppercase">
					{plan.level} · {plan.daysLabel} · {plan.equipment}
				</p>
				<h3 class="mt-1 text-lg font-semibold">{plan.name}</h3>
				<p class="mt-1 text-sm leading-6 text-zinc-400">{plan.summary}</p>
				<button
					type="button"
					class="mt-2 text-sm font-semibold text-lime-300"
					onclick={() => void toggleOutline(plan)}
				>
					{expandedId === plan.id ? 'Hide schedule' : 'Show schedule'}
				</button>
				{#if expandedId === plan.id}
					<div class="mt-3">
						{#if outlineLoading === plan.id}
							<p class="text-sm text-zinc-500">Loading schedule…</p>
						{:else if outlineError[plan.id]}
							<p class="text-sm text-red-300">{outlineError[plan.id]}</p>
						{:else if outlines[plan.id]}
							<PlanOutline plan={outlines[plan.id]} compact />
						{/if}
					</div>
				{/if}
				<div class="mt-3 grid gap-2 {canMerge ? 'grid-cols-2' : 'grid-cols-1'}">
					<button
						type="button"
						class="rounded-2xl py-3 text-sm font-bold disabled:opacity-50 {variant === 'primary'
							? 'bg-lime-400 text-zinc-950'
							: 'border border-zinc-600 font-semibold text-zinc-100'}"
						disabled={busy}
						onclick={() => load(plan, 'replace')}
					>
						{canMerge ? 'Replace week' : 'Load this week'}
					</button>
					{#if canMerge}
						<button
							type="button"
							class="rounded-2xl border border-zinc-600 py-3 text-sm font-semibold text-zinc-100 disabled:opacity-50"
							disabled={busy}
							onclick={() => load(plan, 'merge')}
						>
							Add to week
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}

{#if canMerge}
	<p class="mt-3 text-xs leading-5 text-zinc-500">
		Add to week keeps your current plan and merges the new days by weekday — for example bodyweight
		on the weekend plus a stretching plan on other days.
	</p>
{/if}
