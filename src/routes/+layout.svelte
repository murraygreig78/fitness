<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { fitness } from '$lib/app-state.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import { startPlanReminder, stopPlanReminder } from '$lib/plan-reminder';
	import { APP_NAME } from '$lib/samples';

	let { children } = $props();

	onMount(() => {
		void fitness.init();
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
		const theme = fitness.ready ? fitness.preferences.theme : 'night';
		document.documentElement.dataset.theme = theme;
		const color = theme === 'swiss' ? '#F8F9FA' : '#09090b';
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
