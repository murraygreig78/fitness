<script lang="ts">
	import { base } from '$app/paths';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SamplePlanList from '$lib/components/SamplePlanList.svelte';
	import { downloadJson } from '$lib/download';
	import {
		notificationTimeFromInput,
		reminderPermission,
		requestReminderPermission,
		startPlanReminder
	} from '$lib/plan-reminder';
	import { APP_NAME, KOFI_URL, REPO_URL, starterPlans } from '$lib/samples';
	import { summarizeActivities } from '$lib/schema';
	import { downloadSkillPack } from '$lib/skill-pack';

	type Panel =
		| 'current'
		| 'how-it-works'
		| 'ask-ai'
		| 'starter'
		| 'import-plan'
		| 'import-log'
		| 'reminder'
		| 'coffee';

	let paste = $state('');
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let permission = $state(reminderPermission());
	let selected = $state<Panel | null>(null);

	const panel = $derived(
		selected ?? (fitness.plan ? 'current' : 'how-it-works')
	);

	const menuItems = $derived.by(() => {
		const items: { id: Panel; label: string; hint: string }[] = [];
		if (fitness.plan) {
			items.push({
				id: 'current',
				label: 'Current plan',
				hint: fitness.plan.name
			});
		}
		items.push(
			{
				id: 'how-it-works',
				label: 'How it works',
				hint: 'Local plans, logging, and AI updates'
			},
			{
				id: 'ask-ai',
				label: 'Ask AI to update your week',
				hint: 'Skills, plan JSON, and activity log'
			},
			{
				id: 'starter',
				label: 'Choose a starter plan',
				hint: 'Load a sample week'
			},
			{
				id: 'import-plan',
				label: 'Import a weekly plan',
				hint: 'Paste or upload JSON'
			},
			{
				id: 'import-log',
				label: 'Import past activity',
				hint: 'Bring a log from another device'
			},
			{
				id: 'reminder',
				label: 'Set a reminder',
				hint: fitness.plan ? 'Morning notification time' : 'Load a plan first'
			},
			{
				id: 'coffee',
				label: 'Buy us a coffee',
				hint: 'Support the project on Ko-fi'
			}
		);
		return items;
	});

	function openPanel(next: Panel) {
		message = null;
		error = null;
		selected = next;
	}

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
			selected = 'current';
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
		startPlanReminder(() => fitness.plan);
		selected = 'current';
	}

	async function saveNotificationTime(value: string) {
		if (!fitness.plan) return;
		const notificationTime = notificationTimeFromInput(value);
		const result = await fitness.persistPlan({ ...fitness.plan, notificationTime });
		if (!result.ok) {
			error = result.error;
			return;
		}
		message = `Reminder set for ${notificationTime}.`;
		startPlanReminder(() => fitness.plan);
	}

	async function enableReminders() {
		permission = await requestReminderPermission();
		if (permission === 'granted') startPlanReminder(() => fitness.plan);
	}

	async function exportSkills() {
		error = null;
		try {
			await downloadSkillPack((name) => `${base}/skills/json-activity-tracker/${name}`);
			message =
				'Downloaded the AI skills. Add the zip to Claude, or unzip and upload the files to ChatGPT.';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not download the AI skills';
		}
	}

	function exportPlan() {
		if (!fitness.plan) {
			error = 'Import a weekly fitness plan before exporting it.';
			return;
		}
		downloadJson(`${fitness.plan.id}.json`, fitness.plan);
		message =
			'Downloaded your weekly fitness plan. Send this JSON to a trainer or AI for an updated week.';
	}

	function exportLogs() {
		const backup = fitness.exportBackup();
		downloadJson(`fitness-activity-log-${backup.exportedAt.slice(0, 10)}.json`, backup);
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
			if (fitness.plan) selected = 'current';
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
		Pick what you want to do. Your week lives in a JSON plan that stays on this device.
	</p>
</header>

<div class="space-y-2" role="list">
	{#each menuItems as item (item.id)}
		{@const open = panel === item.id}
		<section
			class="overflow-hidden rounded-3xl border {open
				? 'border-lime-400/50 bg-zinc-900'
				: 'border-zinc-800 bg-zinc-900'}"
			role="listitem"
		>
			<button
				type="button"
				class="flex w-full items-center gap-3 p-4 text-left"
				aria-expanded={open}
				onclick={() => openPanel(item.id)}
			>
				<span class="min-w-0 flex-1">
					<span class="block font-semibold text-zinc-50">{item.label}</span>
					<span class="mt-0.5 block truncate text-sm text-zinc-400">{item.hint}</span>
				</span>
				<Icon
					name={open ? 'check' : 'chevronRight'}
					class="h-5 w-5 shrink-0 {open ? 'text-lime-300' : 'text-zinc-500'}"
				/>
			</button>

			{#if open}
				<div class="border-t border-zinc-800 px-4 pt-3 pb-4">
					{#if item.id === 'current' && fitness.plan}
						<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">This week’s plan</p>
						<h2 class="mt-1 text-lg font-semibold">{fitness.plan.name}</h2>
						<p class="mt-1 text-sm text-zinc-400">
							{fitness.plan.days.length} training days each week
						</p>
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
							Download weekly plan
						</button>
					{:else if item.id === 'how-it-works'}
						<div class="space-y-3 text-sm leading-6 text-zinc-400">
							<p>
								{APP_NAME} keeps your week in a JSON fitness plan and your logs in this browser.
								There is no account and nothing leaves the device unless you download a file.
							</p>
							<p>
								Load a starter week or import your own plan. Open a day from the home screen, then
								log each activity. The keypad remembers last kg and reps for an exercise.
							</p>
							<p>
								To change the week with Claude or ChatGPT: download the AI skills and your plan,
								ask for an updated JSON, then import it here.
							</p>
							<p>
								Moving phones or browsers? Download your activity log, then import it on the other
								device.
							</p>
							<p>
								Pull requests and ideas are welcome on
								<a class="text-lime-300 underline" href={REPO_URL} target="_blank" rel="noreferrer"
									>GitHub</a
								>.
							</p>
						</div>
					{:else if item.id === 'ask-ai'}
						<ol class="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-400">
							<li>
								Download the AI skills and add the zip to Claude, or unzip and upload the files to
								ChatGPT.
							</li>
							<li>Download your current weekly plan.</li>
							<li>
								Optionally download your activity log so the agent can see what you actually did.
							</li>
							<li>
								Ask it to suggest or add exercises. Import the JSON it returns under Import a weekly
								plan.
							</li>
						</ol>
						<div class="mt-3 space-y-2">
							<button
								type="button"
								class="w-full rounded-2xl bg-lime-400 py-3 text-sm font-semibold text-zinc-950"
								onclick={() => void exportSkills()}
							>
								Download AI skills
							</button>
							<button
								type="button"
								class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold disabled:opacity-50"
								disabled={!fitness.plan}
								onclick={exportPlan}
							>
								Download weekly plan
							</button>
							<button
								type="button"
								class="w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
								onclick={exportLogs}
							>
								Download activity log
							</button>
						</div>
					{:else if item.id === 'starter'}
						<p class="mb-3 text-sm leading-6 text-zinc-400">
							Load one of these, then your schedule shows on the home screen.
						</p>
						<SamplePlanList plans={starterPlans} bind:busy bind:error onLoaded={loadedSample} />
					{:else if item.id === 'import-plan'}
						<p class="mb-3 text-sm leading-6 text-zinc-400">
							Bring your own JSON from a trainer or an AI.
						</p>
						<label class="mb-3 block">
							<span class="mb-2 block text-sm text-zinc-400">Upload JSON</span>
							<input
								type="file"
								accept="application/json,.json"
								class="block w-full text-sm text-zinc-300"
								onchange={importFile}
							/>
						</label>
						<label class="mb-3 block">
							<span class="mb-2 block text-sm text-zinc-400">Or paste JSON</span>
							<textarea
								class="min-h-40 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs"
								bind:value={paste}
								placeholder={'{ "version": 2, "id": "...", "days": [{ "activities": [...] }] }'}
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
					{:else if item.id === 'import-log'}
						<p class="mb-3 text-sm leading-6 text-zinc-400">
							Import a JSON activity log from another browser or device. Download a copy from Ask AI
							to update your week.
						</p>
						<label class="block">
							<span class="mb-2 block text-sm text-zinc-400">Upload activity log</span>
							<input
								type="file"
								accept="application/json,.json"
								class="block w-full text-sm text-zinc-300"
								onchange={importLogs}
							/>
						</label>
					{:else if item.id === 'reminder'}
						{#if fitness.plan}
							<label class="block">
								<span class="mb-2 block text-sm text-zinc-400">Morning reminder</span>
								<input
									type="time"
									class="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm"
									value={fitness.plan.notificationTime}
									onchange={(event) => {
										void saveNotificationTime((event.currentTarget as HTMLInputElement).value);
									}}
								/>
								<p class="mt-2 text-xs leading-5 text-zinc-500">
									Notifies you of today’s planned activities. Rest days stay silent. The app needs
									to be open on this device at that time.
								</p>
							</label>
							{#if permission !== 'granted'}
								<button
									type="button"
									class="mt-3 w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold disabled:opacity-50"
									disabled={permission === 'denied' || permission === 'unsupported'}
									onclick={() => void enableReminders()}
								>
									{permission === 'denied' || permission === 'unsupported'
										? 'Notifications are blocked on this device'
										: 'Allow notifications'}
								</button>
							{:else}
								<p class="mt-3 text-sm text-lime-300">Notifications are allowed on this device.</p>
							{/if}
						{:else}
							<p class="text-sm leading-6 text-zinc-400">
								Load or import a weekly plan first, then you can set a morning reminder time.
							</p>
							<button
								type="button"
								class="mt-3 w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
								onclick={() => openPanel('starter')}
							>
								Choose a starter plan
							</button>
						{/if}
					{:else if item.id === 'coffee'}
						<p class="text-sm leading-6 text-zinc-400">
							{APP_NAME} is free and local-first. If it helps your training, a coffee keeps the lights
							on.
						</p>
						<a
							class="mt-3 flex w-full items-center justify-center rounded-2xl bg-lime-400 py-3 text-sm font-semibold text-zinc-950"
							href={KOFI_URL}
							target="_blank"
							rel="noreferrer"
						>
							Buy us a coffee
						</a>
					{/if}
				</div>
			{/if}
		</section>
	{/each}
</div>

{#if message}
	<p class="mt-4 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-3 text-sm text-lime-200">
		{message}
	</p>
{/if}
{#if error}
	<pre
		class="mt-4 overflow-auto rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-xs whitespace-pre-wrap text-red-200">{error}</pre>
{/if}
