<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import {
		analyticsEnabled,
		displayMode,
		plausibleDomain,
		plausibleScriptSrc,
		track
	} from '$lib/analytics';
	import { fitness } from '$lib/app-state.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import { startPlanReminder, stopPlanReminder } from '$lib/plan-reminder';
	import { APP_NAME } from '$lib/samples';

	let { children } = $props();
	const analyticsOn = analyticsEnabled();
	const analyticsDomain = plausibleDomain();
	const analyticsSrc = plausibleScriptSrc();

	onMount(() => {
		void fitness.init().then(() => {
			if (!analyticsOn) return;
			track('app_open', {
				display_mode: displayMode(),
				theme: fitness.preferences.theme,
				has_plan: Boolean(fitness.plan)
			});
		});
		return () => stopPlanReminder();
	});

	$effect(() => {
		if (!fitness.ready) {
			stopPlanReminder();
			return;
		}
		fitness.plan?.notificationTime;
		if (!fitness.plan) {
			stopPlanReminder();
			return;
		}
		startPlanReminder(() => fitness.plan);
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		const theme = fitness.ready ? fitness.preferences.theme : 'swiss';
		document.documentElement.dataset.theme = theme;
		const color = theme === 'night' ? '#09090b' : '#F8F9FA';
		let meta = document.querySelector('meta[name="theme-color"]');
		if (!meta) {
			meta = document.createElement('meta');
			meta.setAttribute('name', 'theme-color');
			document.head.appendChild(meta);
		}
		meta.setAttribute('content', color);
	});
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@400;600;700&display=swap"
		rel="stylesheet"
	/>
	{#if analyticsOn}
		<script defer data-domain={analyticsDomain} src={analyticsSrc}></script>
	{/if}
</svelte:head>

<div class="mx-auto min-h-dvh max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24">
	{#if !fitness.ready}
		<p class="pt-10 text-sm text-zinc-400">Opening local log…</p>
	{:else if fitness.error}
		<p class="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
			{fitness.error}
		</p>
	{:else}
		{@render children()}
	{/if}
</div>

<Nav />
