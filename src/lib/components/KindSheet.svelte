<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { kindIconName, kindTextClass } from '$lib/activity-style';
	import { activityKindLabel, activityKinds, type ActivityKind } from '$lib/schema';

	let {
		onPick,
		onClose
	}: {
		onPick: (kind: ActivityKind) => void;
		onClose: () => void;
	} = $props();
</script>

<div class="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/70 p-4 pb-28">
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		aria-label="Close"
		onclick={onClose}
	></button>
	<div class="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
		<p class="mb-3 text-center text-sm text-zinc-400">Start an unscheduled activity</p>
		<div class="grid grid-cols-4 gap-2">
			{#each activityKinds as kind (kind)}
				<button
					type="button"
					class="flex flex-col items-center gap-2 rounded-2xl bg-zinc-900 px-2 py-4 {kindTextClass(
						kind
					)}"
					onclick={() => onPick(kind)}
				>
					<Icon name={kindIconName(kind)} class="h-6 w-6" />
					<span class="sr-only">{activityKindLabel(kind)}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
