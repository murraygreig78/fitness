<script lang="ts">
	let {
		title,
		canRemove,
		skipped,
		onSkip,
		onUnskip,
		onRemove,
		onClose
	}: {
		title: string;
		canRemove: boolean;
		skipped: boolean;
		onSkip: () => void;
		onUnskip: () => void;
		onRemove: () => void;
		onClose: () => void;
	} = $props();
</script>

<div class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 p-4 pb-28">
	<button
		type="button"
		class="absolute inset-0 cursor-default"
		aria-label="Close"
		onclick={onClose}
	></button>
	<div class="relative w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
		<p class="mb-1 text-center text-xs tracking-[0.16em] text-zinc-500 uppercase">Activity</p>
		<p class="mb-4 truncate text-center text-lg font-semibold">{title}</p>
		<div class="space-y-2">
			{#if skipped}
				<button
					type="button"
					class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
					onclick={onUnskip}
				>
					Undo skip
				</button>
			{:else}
				<button
					type="button"
					class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
					onclick={onSkip}
				>
					Skip
				</button>
			{/if}
			{#if canRemove}
				<button
					type="button"
					class="w-full rounded-2xl border border-red-500/40 py-3 text-sm font-semibold text-red-300"
					onclick={onRemove}
				>
					Remove
				</button>
			{/if}
			<button
				type="button"
				class="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-zinc-300"
				onclick={onClose}
			>
				Cancel
			</button>
		</div>
	</div>
</div>
