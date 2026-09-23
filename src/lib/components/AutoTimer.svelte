<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { formatClock } from '$lib/format';

	let {
		label,
		name,
		secondsRemaining,
		paused,
		onPause,
		onStop
	}: {
		label: string;
		name: string;
		secondsRemaining: number;
		paused: boolean;
		onPause: () => void;
		onStop: () => void;
	} = $props();
</script>

<div
	class="sticky top-0 z-[70] -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-lime-900/40 bg-lime-400 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-zinc-950 shadow-lg"
>
	<div class="min-w-0">
		<p class="text-[11px] font-semibold tracking-[0.18em] uppercase">
			{paused ? 'Paused' : label}
		</p>
		<p class="truncate text-sm font-semibold">{name}</p>
		<p class="font-mono text-3xl font-bold tabular-nums">{formatClock(secondsRemaining)}</p>
	</div>
	<div class="flex shrink-0 items-center gap-2">
		<button
			type="button"
			class="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 text-lime-300"
			aria-label={paused ? 'Resume auto timer' : 'Pause auto timer'}
			onclick={onPause}
		>
			<Icon name={paused ? 'play' : 'pause'} class="h-6 w-6" />
		</button>
		<button
			type="button"
			class="inline-flex h-11 items-center gap-1 rounded-full bg-zinc-950 px-3 text-sm font-semibold text-lime-300"
			aria-label="Stop auto timer"
			onclick={onStop}
		>
			<Icon name="stop" class="h-5 w-5" />
			Stop
		</button>
	</div>
</div>
