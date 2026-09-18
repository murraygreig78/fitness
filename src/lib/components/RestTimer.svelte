<script lang="ts">
	import { formatClock } from '$lib/format';

	let {
		secondsRemaining,
		onSkip
	}: {
		secondsRemaining: number;
		onSkip: () => void;
	} = $props();
</script>

<div
	class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-lime-900/40 bg-lime-400 px-4 py-3 text-zinc-950"
>
	<div>
		<p class="text-[11px] font-semibold tracking-[0.18em] uppercase">Rest</p>
		<p class="font-mono text-2xl font-bold tabular-nums">{formatClock(secondsRemaining)}</p>
	</div>
	<button
		type="button"
		class="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-lime-300"
		onclick={onSkip}
	>
		Skip rest
	</button>
</div>
