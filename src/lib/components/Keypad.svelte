<script lang="ts">
	import { formatNumber, parseDraftNumber } from '$lib/format';
	import { untrack } from 'svelte';

	let {
		label,
		unit,
		value,
		previous,
		target,
		step = 1,
		allowDecimal = false,
		onCommit,
		onClose
	}: {
		label: string;
		unit: string;
		value: number | undefined;
		previous: number | undefined;
		target: number | undefined;
		step?: number;
		allowDecimal?: boolean;
		onCommit: (next: number | undefined) => void;
		onClose: () => void;
	} = $props();

	let draft = $state(untrack(() => (value == null ? '' : String(value))));
	const keys = $derived([
		'1',
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		allowDecimal ? '.' : '',
		'0',
		'⌫'
	]);

	function press(key: string) {
		if (key === '') return;
		if (key === '⌫') {
			draft = draft.slice(0, -1);
			return;
		}
		if (key === '.') {
			if (draft.includes('.')) return;
			draft = draft ? `${draft}.` : '0.';
			return;
		}
		if (draft === '0' && key !== '.') {
			draft = key;
			return;
		}
		draft += key;
	}

	function nudge(direction: 1 | -1) {
		const current = parseDraftNumber(draft) ?? 0;
		const next = Math.max(0, roundToStep(current + direction * step));
		draft = String(next);
	}

	function roundToStep(n: number): number {
		const scaled = Math.round(n / step) * step;
		return Number(scaled.toFixed(allowDecimal ? 2 : 0));
	}

	function usePrevious() {
		if (previous == null) return;
		draft = String(previous);
	}

	function done() {
		onCommit(parseDraftNumber(draft));
	}
</script>

<div
	class="fixed inset-0 z-50 flex flex-col justify-end bg-black/70"
	onclick={onClose}
	onkeydown={(event) => event.key === 'Escape' && onClose()}
	role="presentation"
>
	<div
		class="rounded-t-3xl border-t border-zinc-700 bg-zinc-900 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
		role="dialog"
		tabindex="-1"
		aria-label={`Edit ${label}`}
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<p class="text-xs font-semibold tracking-[0.2em] text-zinc-400 uppercase">{label}</p>
				<p class="font-mono text-4xl font-semibold tabular-nums text-zinc-50">
					{draft || '0'}<span class="ml-2 text-lg text-zinc-500">{unit}</span>
				</p>
			</div>
			<button type="button" class="text-sm text-zinc-400" onclick={onClose}>Close</button>
		</div>

		<div class="mb-3 flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded-full border border-lime-400/70 bg-lime-400/10 px-3 py-2 text-sm font-semibold text-lime-300 disabled:border-zinc-700 disabled:bg-transparent disabled:text-zinc-600"
				disabled={previous == null}
				onclick={usePrevious}
			>
				Prev {previous == null ? '' : formatNumber(previous)}
			</button>
			{#if target != null}
				<button
					type="button"
					class="rounded-full border border-zinc-600 px-3 py-2 text-sm text-zinc-300"
					onclick={() => (draft = String(target))}
				>
					Target {formatNumber(target)}
				</button>
			{/if}
		</div>

		<div class="mb-3 grid grid-cols-2 gap-2">
			<button
				type="button"
				class="rounded-2xl bg-zinc-800 py-3 text-lg font-semibold"
				onclick={() => nudge(-1)}
			>
				− {step}
			</button>
			<button
				type="button"
				class="rounded-2xl bg-zinc-800 py-3 text-lg font-semibold"
				onclick={() => nudge(1)}
			>
				+ {step}
			</button>
		</div>

		<div class="grid grid-cols-3 gap-2">
			{#each keys as key (key || 'blank')}
				<button
					type="button"
					class="min-h-14 rounded-2xl bg-zinc-800 text-xl font-semibold disabled:opacity-0"
					disabled={key === ''}
					onclick={() => press(key)}
				>
					{key}
				</button>
			{/each}
		</div>

		<button
			type="button"
			class="mt-3 w-full rounded-2xl bg-lime-400 py-3 text-base font-bold text-zinc-950"
			onclick={done}
		>
			Save
		</button>
	</div>
</div>
