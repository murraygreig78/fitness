<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { formatNumber, parseDraftNumber } from '$lib/format';
	import { onDestroy, onMount, untrack } from 'svelte';

	let {
		label,
		unit,
		value,
		last,
		allowDecimal = false,
		showTimer = false,
		onCommit,
		onClose,
		onTimer
	}: {
		label: string;
		unit: string;
		value: number | undefined;
		last: number | undefined;
		allowDecimal?: boolean;
		showTimer?: boolean;
		onCommit: (next: number | undefined) => void | Promise<void>;
		onClose: () => void;
		onTimer?: () => void;
	} = $props();

	let draft = $state(untrack(() => (value == null ? '' : String(value))));
	let saving = $state(false);
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

	function useLast() {
		if (last == null) return;
		draft = String(last);
	}

	async function done(event?: Event) {
		event?.stopPropagation();
		if (saving) return;
		saving = true;
		try {
			await onCommit(parseDraftNumber(draft));
		} finally {
			saving = false;
		}
	}

	function startTimer() {
		onTimer?.();
	}

	function onBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
			return;
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault();
			void done();
			return;
		}
		if (event.key === 'Backspace') {
			event.preventDefault();
			press('⌫');
			return;
		}
		if (/^[0-9]$/.test(event.key)) {
			event.preventDefault();
			press(event.key);
			return;
		}
		if (allowDecimal && (event.key === '.' || event.key === ',')) {
			event.preventDefault();
			press('.');
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKey);
	});
	onDestroy(() => {
		window.removeEventListener('keydown', onKey);
	});
</script>

<div
	class="fixed inset-0 z-[80] flex flex-col justify-end bg-black/70"
	onclick={onBackdrop}
	role="presentation"
>
	<div
		class="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-zinc-700 bg-zinc-900 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
		role="dialog"
		tabindex="-1"
		aria-label={`Edit ${label}`}
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<p class="text-sm text-zinc-400">{label}</p>
				<p class="font-mono text-4xl font-semibold tabular-nums text-zinc-50">
					{draft || '0'}<span class="ml-2 text-lg text-zinc-500">{unit}</span>
				</p>
			</div>
			<button type="button" class="text-sm text-zinc-400" onclick={onClose}>Close</button>
		</div>

		<button
			type="button"
			class="mb-3 w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold text-zinc-100 disabled:border-zinc-800 disabled:text-zinc-600"
			disabled={last == null}
			onclick={useLast}
		>
			Last{last == null ? '' : ` ${formatNumber(last)}`}
		</button>

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

		<div class="mt-3 flex gap-2">
			{#if showTimer}
				<button
					type="button"
					class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-600 text-zinc-100"
					aria-label="Start rest timer"
					onclick={startTimer}
				>
					<Icon name="timer" class="h-6 w-6" />
				</button>
			{/if}
			<button
				type="button"
				class="flex h-14 min-w-0 flex-1 items-center justify-center rounded-2xl bg-lime-400 font-mono text-2xl font-semibold text-zinc-950 disabled:opacity-60"
				disabled={saving}
				aria-label="Save and next"
				onclick={(event) => void done(event)}
			>
				→|
			</button>
		</div>
	</div>
</div>
