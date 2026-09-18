<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import type { IconName } from '$lib/components/Icon.svelte';

	const items: { href: '/' | '/activities' | '/plan'; label: string; icon: IconName }[] = [
		{ href: '/', label: 'Week', icon: 'calendar' },
		{ href: '/activities', label: 'Activities', icon: 'stats' },
		{ href: '/plan', label: 'Admin', icon: 'admin' }
	];

	function active(href: string): boolean {
		const id = page.route.id ?? '';
		if (href === '/') {
			return id === '/' || id.startsWith('/session/');
		}
		if (href === '/activities') {
			return id === '/activities' || id === '/progress';
		}
		return id === href || id.startsWith(`${href}/`);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
	style="padding-bottom: env(safe-area-inset-bottom)"
>
	<ul class="mx-auto grid max-w-lg grid-cols-3">
		{#each items as item (item.href)}
			<li>
				<a
					href={resolve(item.href)}
					aria-label={item.label}
					class="flex min-h-14 items-center justify-center {active(item.href)
						? 'text-lime-300'
						: 'text-zinc-500'}"
				>
					<Icon name={item.icon} class="h-6 w-6" />
				</a>
			</li>
		{/each}
	</ul>
</nav>
