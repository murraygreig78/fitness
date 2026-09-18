<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { fitness } from '$lib/app-state.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { children } = $props();

	onMount(() => {
		void fitness.init();
	});
</script>

<svelte:head>
	<title>Fitness</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap"
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
