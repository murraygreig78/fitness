<script lang="ts">
	import { resolve } from '$app/paths';
	import SamplePlanList from '$lib/components/SamplePlanList.svelte';
	import { APP_NAME, KOFI_URL, REPO_URL, starterPlans } from '$lib/samples';

	let busy = $state(false);
	let error = $state<string | null>(null);
</script>

<header class="mb-6">
	<h1 class="text-2xl font-bold">Welcome to {APP_NAME}</h1>
</header>

<div class="space-y-4 text-sm leading-6 text-zinc-400">
	<p>First, load a weekly plan. Once that is done, your schedule shows on the home screen.</p>
	<p>
		You do not share any information with us. Everything stays in this browser’s local storage, so
		if you open a different browser, your data will not be there.
	</p>
	<p>
		If you would like us to add sync, let us know. Pull requests and feature requests are welcome on
		<a class="text-lime-300 underline" href={REPO_URL} target="_blank" rel="noreferrer"
			>the GitHub repo</a
		>. Please feel free to
		<a class="text-lime-300 underline" href={KOFI_URL} target="_blank" rel="noreferrer"
			>buy us a coffee</a
		>.
	</p>
</div>

<section class="mt-8">
	<h2 class="mb-3 text-lg font-semibold">Choose a weekly plan</h2>
	<SamplePlanList plans={starterPlans} bind:busy bind:error />
</section>

<p class="mt-5 text-sm leading-6 text-zinc-400">
	Or
	<a class="text-lime-300 underline" href={resolve('/plan')}>import your own JSON in Admin</a>.
</p>

{#if error}
	<pre
		class="mt-4 overflow-auto rounded-2xl border border-red-500/40 bg-red-950/40 p-3 text-xs whitespace-pre-wrap text-red-200">{error}</pre>
{/if}
