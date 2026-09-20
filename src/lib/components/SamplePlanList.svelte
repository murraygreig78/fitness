<script lang="ts">
	import { asset } from '$app/paths';
	import { importSampleFromUrl, type SamplePlanInfo } from '$lib/samples';

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
		onLoaded?: () => void;
	} = $props();

	async function load(plan: SamplePlanInfo) {
		busy = true;
		error = null;
		try {
			await importSampleFromUrl(asset(plan.file));
			onLoaded?.();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not load sample';
		} finally {
			busy = false;
		}
	}
</script>

<ul class="space-y-3">
	{#each plans as plan (plan.id)}
		<li class="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
			<p class="text-xs font-semibold tracking-[0.16em] text-lime-300 uppercase">
				{plan.level} · {plan.daysLabel}
			</p>
			<h3 class="mt-1 text-lg font-semibold">{plan.name}</h3>
			<p class="mt-1 text-sm leading-6 text-zinc-400">{plan.summary}</p>
			<button
				type="button"
				class="mt-3 w-full rounded-2xl py-3 text-sm font-bold disabled:opacity-50 {variant ===
				'primary'
					? 'bg-lime-400 text-zinc-950'
					: 'border border-zinc-600 font-semibold text-zinc-100'}"
				disabled={busy}
				onclick={() => load(plan)}
			>
				Load this week
			</button>
		</li>
	{/each}
</ul>
