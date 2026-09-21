<script lang="ts">
	import { fitness } from '$lib/app-state.svelte';
	import SamplePlanList from '$lib/components/SamplePlanList.svelte';
	import { starterPlans } from '$lib/samples';
	import { summarizeActivities } from '$lib/schema';

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
			message = `Loaded ${fitness.plan?.name ?? 'weekly plan'}. It will repeat each week.`;
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

	function loadedSample() {
		error = null;
		message = `Loaded ${fitness.plan?.name ?? 'weekly plan'}. It will repeat each week.`;
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

	function exportPlan() {
		if (!fitness.plan) {
			error = 'Import a weekly fitness plan before exporting it.';
			return;
		}
		download(`${fitness.plan.id}.json`, fitness.plan);
		message =
			'Downloaded your weekly fitness plan. Send this JSON to a trainer or AI for an updated week.';
	}

	function exportLogs() {
		const backup = fitness.exportBackup();
		download(`fitness-activity-log-${backup.exportedAt.slice(0, 10)}.json`, backup);
		message =
			'Downloaded your activity log. Send this to a trainer or AI so they can recommend the next plan.';
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
			message = `Imported ${fitness.sessions.length} logged activities.`;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not import activity log';
		} finally {
			busy = false;
			input.value = '';
		}
	}
</script>

<header class="mb-6">
	<p class="text-xs font-semibold tracking-[0.22em] text-lime-300 uppercase">Admin</p>
	<h1 class="text-2xl font-bold">Weekly fitness plan</h1>
	<p class="mt-1 text-sm leading-6 text-zinc-400">
		Your week lives in a JSON fitness plan. Export it, send it to a trainer or AI, then import the
		updated plan they send back.
	</p>
</header>

{#if fitness.plan}
	<section class="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
		<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">This week’s plan</p>
		<h2 class="mt-1 text-lg font-semibold">{fitness.plan.name}</h2>
		<p class="mt-1 text-sm text-zinc-400">{fitness.plan.days.length} training days each week</p>
		{#if fitness.plan.notes}
			<p class="mt-2 text-sm leading-6 text-zinc-400">{fitness.plan.notes}</p>
		{/if}
		<ul class="mt-3 space-y-1 text-sm text-zinc-300">
			{#each fitness.plan.days as day (day.id)}
				<li>{day.weekday}: {day.name} · {summarizeActivities(day.activities)}</li>
			{/each}
		</ul>
		<button
			type="button"
			class="mt-4 w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
			onclick={exportPlan}
		>
			Export weekly plan
		</button>
	</section>
{/if}

<section class="mb-5 space-y-3">
	<h2 class="font-semibold">Starter weeks</h2>
	<p class="text-sm leading-6 text-zinc-400">
		Load one of these, then your schedule shows on the home screen.
	</p>
	<SamplePlanList plans={starterPlans} bind:busy bind:error onLoaded={loadedSample} />
</section>

<section class="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
	<h2 class="font-semibold">Import weekly plan</h2>
	<p class="text-sm leading-6 text-zinc-400">Bring your own JSON from a trainer or an AI.</p>
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
			placeholder={'{ "version": 2, "id": "...", "days": [{ "activities": [...] }] }'}></textarea>
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
	<h2 class="font-semibold">Activity log</h2>
	<p class="text-sm leading-6 text-zinc-400">
		Export a JSON log of the activities you have done. Send it to your personal trainer or an AI
		agent so they can review the work and recommend the next weekly plan.
	</p>
	<button
		type="button"
		class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
		onclick={exportLogs}
	>
		Export activity log
	</button>
	<label class="block">
		<span class="mb-2 block text-sm text-zinc-400">Import activity log</span>
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
