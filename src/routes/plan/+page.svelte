<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import { parsePlanJson } from '$lib/schema';

	let paste = $state('');
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function readJson(text: string): Promise<unknown> {
		try {
			return JSON.parse(text);
		} catch {
			throw new Error('That file is not valid JSON');
		}
	}

	async function importObject(input: unknown) {
		busy = true;
		error = null;
		message = null;
		try {
			const result = await fitness.importPlan(input);
			if (!result.ok) {
				error = result.error;
				return;
			}
			message = `Loaded ${fitness.plan?.name ?? 'plan'}. It will repeat each week.`;
		} finally {
			busy = false;
		}
	}

	async function importPasted() {
		try {
			await importObject(await readJson(paste));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not import';
		}
	}

	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			await importObject(await readJson(await file.text()));
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not import';
		} finally {
			input.value = '';
		}
	}

	async function loadSample() {
		busy = true;
		error = null;
		message = null;
		try {
			const response = await fetch('/plans/weekly.json');
			if (!response.ok) throw new Error('Sample plan was not found');
			const json: unknown = await response.json();
			const parsed = parsePlanJson(json);
			if ('error' in parsed) {
				error = parsed.error;
				return;
			}
			await importObject(parsed.plan);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not load sample';
		} finally {
			busy = false;
		}
	}

	function download(filename: string, payload: unknown) {
		const blob = new Blob([JSON.stringify(payload, null, '\t')], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	function exportLogs() {
		const backup = fitness.exportBackup();
		download(`fitness-logs-${backup.exportedAt.slice(0, 10)}.json`, backup);
		message = 'Downloaded a private backup of your sessions. Do not commit this file.';
	}

	async function importLogs(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		busy = true;
		error = null;
		message = null;
		try {
			const result = await fitness.importBackup(await readJson(await file.text()));
			if (!result.ok) {
				error = result.error;
				return;
			}
			message = `Restored ${fitness.sessions.length} sessions.`;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not restore logs';
		} finally {
			busy = false;
			input.value = '';
		}
	}
</script>

<header class="mb-6">
	<p class="text-xs font-semibold tracking-[0.22em] text-lime-300 uppercase">Plan</p>
	<h1 class="text-2xl font-bold">JSON template</h1>
	<p class="mt-1 text-sm leading-6 text-zinc-400">
		Edit <code class="text-zinc-200">plans/weekly.json</code> in git, or import a file here. Logs stay
		in this browser unless you export them.
	</p>
</header>

{#if fitness.plan}
	<section class="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
		<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">Active plan</p>
		<h2 class="mt-1 text-lg font-semibold">{fitness.plan.name}</h2>
		<p class="mt-1 text-sm text-zinc-400">{fitness.plan.days.length} training days each week</p>
		{#if fitness.plan.notes}
			<p class="mt-2 text-sm leading-6 text-zinc-400">{fitness.plan.notes}</p>
		{/if}
		<ul class="mt-3 space-y-1 text-sm text-zinc-300">
			{#each fitness.plan.days as day (day.id)}
				<li>{day.weekday}: {day.name} · {day.exercises.length} exercises</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
	<h2 class="font-semibold">Import plan</h2>
	<button
		type="button"
		class="w-full rounded-2xl bg-lime-400 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
		disabled={busy}
		onclick={loadSample}
	>
		Load sample week
	</button>
	<label class="block">
		<span class="mb-2 block text-sm text-zinc-400">Upload JSON</span>
		<input
			type="file"
			accept="application/json,.json"
			class="block w-full text-sm text-zinc-300"
			onchange={importFile}
		/>
	</label>
	<label class="block">
		<span class="mb-2 block text-sm text-zinc-400">Or paste JSON</span>
		<textarea
			class="min-h-40 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs"
			bind:value={paste}
			placeholder={'{ "version": 1, "id": "...", ... }'}
		></textarea>
	</label>
	<button
		type="button"
		class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold disabled:opacity-50"
		disabled={busy || !paste.trim()}
		onclick={importPasted}
	>
		Validate and import
	</button>
</section>

<section class="mt-5 space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
	<h2 class="font-semibold">Private log backup</h2>
	<p class="text-sm leading-6 text-zinc-400">
		Session history lives in IndexedDB on this device. Export a JSON backup if you change browsers.
		Keep that file off the public site.
	</p>
	<button
		type="button"
		class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
		onclick={exportLogs}
	>
		Export logs
	</button>
	<label class="block">
		<span class="mb-2 block text-sm text-zinc-400">Restore logs JSON</span>
		<input
			type="file"
			accept="application/json,.json"
			class="block w-full text-sm text-zinc-300"
			onchange={importLogs}
		/>
	</label>
</section>

{#if message}
	<p class="mt-4 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-3 text-sm text-lime-200">
		{message}
	</p>
{/if}
{#if error}
	<pre
		class="mt-4 overflow-auto rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-xs whitespace-pre-wrap text-red-200">{error}</pre>
{/if}
