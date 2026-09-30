<script lang="ts">
	import { effortLevels, type EffortLevel } from '$lib/units';

	let {
		value,
		onChange
	}: {
		value: number | undefined;
		onChange: (next: EffortLevel | undefined) => void;
	} = $props();
</script>

<div>
	<p class="mb-2 text-sm text-zinc-400">Effort</p>
	<div class="flex items-center gap-3">
		<span class="w-10 shrink-0 text-xs tracking-[0.12em] text-zinc-500 uppercase">Easy</span>
		<div
			class="flex flex-1 items-center justify-between px-1"
			role="group"
			aria-label="Effort level"
		>
			{#each effortLevels as level (level.value)}
				<button
					type="button"
					aria-label={level.label}
					aria-pressed={value === level.value}
					class="h-9 w-9 rounded-full transition-colors {value === level.value
						? 'bg-lime-400'
						: 'border-2 border-zinc-600 bg-transparent hover:border-zinc-400'}"
					onclick={() => onChange(value === level.value ? undefined : level.value)}
				></button>
			{/each}
		</div>
		<span class="w-10 shrink-0 text-right text-xs tracking-[0.12em] text-zinc-500 uppercase"
			>Hard</span
		>
	</div>
	<p class="mt-2 text-xs leading-5 text-zinc-500">Optional. Tap again to clear.</p>
</div>
