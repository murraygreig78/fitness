<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { kindIconName, kindTextClass } from '$lib/activity-style';
	import { activityPreview } from '$lib/metrics';
	import {
		activityKindLabel,
		activityKinds,
		planActivitiesOfKind,
		type Activity,
		type ActivityKind,
		type Plan
	} from '$lib/schema';
	import { weekdayLabel } from '$lib/week';

	let {
		plan,
		onPickKind,
		onPickPlanActivity,
		onClose
	}: {
		plan: Plan | null;
		onPickKind: (kind: ActivityKind) => void;
		onPickPlanActivity: (activity: Activity) => void;
		onClose: () => void;
	} = $props();

	let kind = $state<ActivityKind | null>(null);

	const options = $derived(
		plan && kind ? planActivitiesOfKind(plan, kind) : []
	);

	function pickKind(next: ActivityKind) {
		kind = next;
	}

	function pickCustom() {
		if (!kind) return;
		onPickKind(kind);
	}
</script>

<div class="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/70 p-4 pb-28">
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		aria-label="Close"
		onclick={onClose}
	></button>
	<div class="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
		{#if kind == null}
			<p class="mb-3 text-center text-sm text-zinc-400">Start an unscheduled activity</p>
			<div class="grid grid-cols-4 gap-2">
				{#each activityKinds as item (item)}
					<button
						type="button"
						class="flex flex-col items-center gap-2 rounded-2xl bg-zinc-900 px-2 py-4 {kindTextClass(
							item
						)}"
						onclick={() => pickKind(item)}
					>
						<Icon name={kindIconName(item)} class="h-6 w-6" />
						<span class="text-[11px] font-semibold tracking-[0.08em] uppercase">
							{activityKindLabel(item)}
						</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="mb-3 flex items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-1 text-sm text-zinc-400"
					onclick={() => (kind = null)}
				>
					<Icon name="back" class="h-4 w-4" />
					Kinds
				</button>
				<p class="min-w-0 flex-1 truncate text-right text-sm text-zinc-400">
					{activityKindLabel(kind)} from this week
				</p>
			</div>
			{#if options.length}
				<ul class="mb-3 max-h-72 space-y-2 overflow-y-auto">
					{#each options as option (option.activity.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left"
								onclick={() => onPickPlanActivity(option.activity)}
							>
								<span
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 {kindTextClass(
										option.activity.kind
									)}"
								>
									<Icon name={kindIconName(option.activity.kind)} class="h-5 w-5" />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-medium">{option.activity.name}</span>
									<span class="block truncate text-sm text-zinc-500">
										{weekdayLabel(option.weekday, 'long')} · {activityPreview(option.activity)}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mb-3 text-sm leading-6 text-zinc-500">
					No {activityKindLabel(kind).toLowerCase()} activities in this week’s plan.
				</p>
			{/if}
			<button
				type="button"
				class="w-full rounded-2xl border border-dashed border-zinc-600 py-3 text-sm font-semibold text-zinc-200"
				onclick={pickCustom}
			>
				Custom blank {activityKindLabel(kind).toLowerCase()}
			</button>
		{/if}
	</div>
</div>
