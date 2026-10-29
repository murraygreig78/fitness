<script lang="ts">
	import { goto } from '$app/navigation';
	import { base, resolve } from '$app/paths';
	import { fitness } from '$lib/app-state.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PlanOutline from '$lib/components/PlanOutline.svelte';
	import SamplePlanList from '$lib/components/SamplePlanList.svelte';
	import { downloadJson } from '$lib/download';
	import {
		notificationTimeFromInput,
		reminderPermission,
		requestReminderPermission,
		startPlanReminder
	} from '$lib/plan-reminder';
	import { APP_NAME, KOFI_URL, REPO_URL, starterPlans } from '$lib/samples';
	import { downloadSkillPack } from '$lib/skill-pack';
	import { themeLabel } from '$lib/units';

	type Panel =
		| 'getting-started'
		| 'week'
		| 'ask-ai'
		| 'import-plan'
		| 'import-log'
		| 'units'
		| 'appearance'
		| 'screen'
		| 'reminder'
		| 'coffee';

	let paste = $state('');
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let permission = $state(reminderPermission());
	let selected = $state<Panel | null>(null);

	const panel = $derived(selected ?? (fitness.plan ? 'week' : 'getting-started'));

	const menuItems = $derived.by(() => {
		const items: { id: Panel; label: string; hint: string }[] = [
			{
				id: 'getting-started',
				label: 'Getting started',
				hint: 'Install the app, load a week, and log'
			},
			{
				id: 'week',
				label: 'Weekly plan',
				hint: fitness.plan ? fitness.plan.name : 'Choose or build a starter week'
			},
			{
				id: 'ask-ai',
				label: 'Ask AI to update your week',
				hint: 'Skills, plan JSON, and activity log'
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
				id: 'units',
				label: 'Units',
				hint:
					fitness.preferences.weightUnit === 'lb' || fitness.preferences.distanceUnit === 'mi'
						? `${fitness.preferences.weightUnit === 'lb' ? 'lb' : 'kg'} · ${fitness.preferences.distanceUnit === 'mi' ? 'miles' : 'km'}`
						: 'Kilograms and kilometres'
			},
			{
				id: 'appearance',
				label: 'Appearance',
				hint: themeLabel(fitness.preferences.theme)
			},
			{
				id: 'screen',
				label: 'Keep screen awake',
				hint: fitness.preferences.keepScreenAwake ? 'On while an activity is open' : 'Off'
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
		];
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
			selected = 'week';
			await goto(resolve('/'));
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

	async function loadedSample(mode: 'replace' | 'merge', sample: (typeof starterPlans)[number]) {
		error = null;
		startPlanReminder(() => fitness.plan);
		selected = 'week';
		if (mode === 'merge') {
			message = `Added “${sample.name}” into your week. The schedule above now includes those days and exercises.`;
		} else {
			message = `Loaded “${fitness.plan?.name ?? sample.name}”. It will repeat each week.`;
		}
		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
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
			if (fitness.plan) selected = 'week';
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
	<h1 class="text-2xl font-bold">{APP_NAME}</h1>
	<p class="mt-1 text-sm leading-6 text-zinc-400">Choose your weekly fitness plan.</p>
</header>

{#if message}
	<p class="mb-4 rounded-2xl border border-lime-400/30 bg-lime-400/10 p-3 text-sm text-lime-200">
		{message}
	</p>
{/if}
{#if error}
	<pre
		class="mb-4 overflow-auto rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-xs whitespace-pre-wrap text-red-200">{error}</pre>
{/if}

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
					{#if item.id === 'week'}
						{#if fitness.plan}
							<p class="text-xs tracking-[0.16em] text-zinc-500 uppercase">This week’s plan</p>
							<h2 class="mt-1 text-lg font-semibold">{fitness.plan.name}</h2>
							<p class="mt-1 text-sm text-zinc-400">
								{fitness.plan.days.length} training days each week
							</p>
							{#if fitness.plan.notes}
								<p class="mt-2 text-sm leading-6 text-zinc-400">{fitness.plan.notes}</p>
							{/if}
							<div class="mt-3">
								<PlanOutline plan={fitness.plan} />
							</div>
							<button
								type="button"
								class="mt-4 w-full rounded-2xl border border-zinc-600 py-3 text-sm font-semibold"
								onclick={exportPlan}
							>
								Download weekly plan
							</button>
							<p class="mt-5 mb-3 text-sm leading-6 text-zinc-400">
								Replace this week with a starter, or add another starter into these days.
							</p>
						{:else}
							<p class="mb-3 text-sm leading-6 text-zinc-400">
								No week loaded yet. Pick a starter below, or import JSON. Use Show schedule to see
								which exercises fall on which days before you load one.
							</p>
						{/if}
						<SamplePlanList plans={starterPlans} bind:busy bind:error onLoaded={loadedSample} />
					{:else if item.id === 'getting-started'}
						<div class="space-y-4 text-sm leading-6 text-zinc-400">
							<p>
								{APP_NAME} is a local training log. Your week lives in a JSON plan and your history stays
								in this browser — there is no account, and nothing leaves the device unless you download
								a file.
							</p>

							<div>
								<p class="font-semibold text-zinc-200">1. Save it on your phone</p>
								<p class="mt-1">
									Add this site to your Home Screen so it opens like an app, stays in portrait, and
									is easier to reach mid-workout.
								</p>
								<ul class="mt-2 list-disc space-y-2 pl-5">
									<li>
										<span class="font-medium text-zinc-300">iPhone (Safari):</span> open this site, tap
										Share, then Add to Home Screen. Open it from the new icon afterwards.
									</li>
									<li>
										<span class="font-medium text-zinc-300">Android (Chrome):</span> open this site, tap
										the menu (⋮), then Add to Home screen or Install app. Open it from the new icon afterwards.
									</li>
								</ul>
							</div>

							<div>
								<p class="font-semibold text-zinc-200">2. Load a week</p>
								<p class="mt-1">
									Open Weekly plan and pick a starter. Use Show schedule to see which exercises fall
									on which days. You can Replace week, or Add to week to combine modules — for
									example Home dumbbell week, then Daily cardio, then Full-body stretch.
								</p>
							</div>

							<div>
								<p class="font-semibold text-zinc-200">3. Log as you train</p>
								<p class="mt-1">
									From the home screen, open a day, then an activity. Mark sets complete and enter
									kg, reps, or time. The keypad can fill the last value you used for that exercise.
								</p>
							</div>

							<div>
								<p class="font-semibold text-zinc-200">4. Change or move the week</p>
								<p class="mt-1">
									Ask AI to update your week downloads skills and your plan for Claude or ChatGPT.
									Import the JSON it returns here. Moving phones? Download your activity log, then
									import it on the other device.
								</p>
							</div>

							<div>
								<p class="font-semibold text-zinc-200">5. It stays on this device</p>
								<p class="mt-1">Your plan stays on this device, as does your activity.</p>
							</div>

							<p>
								Ideas and pull requests are welcome on
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
					{:else if item.id === 'units'}
						<p class="mb-4 text-sm leading-6 text-zinc-400">
							Defaults are kilograms and kilometres. Values are still stored in kg and km so your
							JSON stays consistent when you export.
						</p>
						<div class="space-y-4">
							<div>
								<p class="mb-2 text-sm text-zinc-400">Weight</p>
								<div class="grid grid-cols-2 gap-2">
									<button
										type="button"
										class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences
											.weightUnit === 'kg'
											? 'bg-lime-400 text-zinc-950'
											: 'border border-zinc-700 text-zinc-200'}"
										onclick={() => void fitness.setWeightUnit('kg')}
									>
										Kilograms
									</button>
									<button
										type="button"
										class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences
											.weightUnit === 'lb'
											? 'bg-lime-400 text-zinc-950'
											: 'border border-zinc-700 text-zinc-200'}"
										onclick={() => void fitness.setWeightUnit('lb')}
									>
										Pounds
									</button>
								</div>
							</div>
							<div>
								<p class="mb-2 text-sm text-zinc-400">Distance</p>
								<div class="grid grid-cols-2 gap-2">
									<button
										type="button"
										class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences
											.distanceUnit === 'km'
											? 'bg-lime-400 text-zinc-950'
											: 'border border-zinc-700 text-zinc-200'}"
										onclick={() => void fitness.setDistanceUnit('km')}
									>
										Kilometres
									</button>
									<button
										type="button"
										class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences
											.distanceUnit === 'mi'
											? 'bg-lime-400 text-zinc-950'
											: 'border border-zinc-700 text-zinc-200'}"
										onclick={() => void fitness.setDistanceUnit('mi')}
									>
										Miles
									</button>
								</div>
							</div>
						</div>
					{:else if item.id === 'appearance'}
						<p class="mb-4 text-sm leading-6 text-zinc-400">
							Industrial Swiss is the default: off-white surfaces, charcoal type, wireframe borders,
							and safety orange for actions. Pale sky blue is reserved for the calendar day dots.
							Night keeps the older dark lime look.
						</p>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences.theme === 'swiss'
									? 'bg-lime-400 text-zinc-950'
									: 'border border-zinc-700 text-zinc-200'}"
								onclick={() => void fitness.setTheme('swiss')}
							>
								Swiss
							</button>
							<button
								type="button"
								class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences.theme === 'night'
									? 'bg-lime-400 text-zinc-950'
									: 'border border-zinc-700 text-zinc-200'}"
								onclick={() => void fitness.setTheme('night')}
							>
								Night
							</button>
						</div>
						<p class="mt-4 text-xs leading-5 text-zinc-500">
							Swiss uses Inter and flatter cards. Your choice is saved on this device.
						</p>
					{:else if item.id === 'screen'}
						<p class="mb-4 text-sm leading-6 text-zinc-400">
							When on, the phone screen stays awake for the whole activity session so it doesn’t
							lock while you’re doing a set. Default is on.
						</p>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								class="rounded-2xl py-3 text-sm font-semibold {fitness.preferences.keepScreenAwake
									? 'bg-lime-400 text-zinc-950'
									: 'border border-zinc-700 text-zinc-200'}"
								onclick={() => void fitness.setKeepScreenAwake(true)}
							>
								On
							</button>
							<button
								type="button"
								class="rounded-2xl py-3 text-sm font-semibold {!fitness.preferences.keepScreenAwake
									? 'bg-lime-400 text-zinc-950'
									: 'border border-zinc-700 text-zinc-200'}"
								onclick={() => void fitness.setKeepScreenAwake(false)}
							>
								Off
							</button>
						</div>
						<p class="mt-4 text-sm leading-6 text-zinc-400">
							For the best portrait layout, add this site to your Home Screen and open it from
							there. The installed app asks the phone to stay in portrait; a normal browser tab can
							still rotate.
						</p>
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
								onclick={() => openPanel('week')}
							>
								Open weekly plan
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
