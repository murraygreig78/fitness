<script lang="ts">
	import { page } from '$app/state';

	const items = [
		{ href: '/', label: 'Week' },
		{ href: '/compare', label: 'Compare' },
		{ href: '/progress', label: 'Progress' },
		{ href: '/plan', label: 'Plan' }
	];

	function active(href: string): boolean {
		if (href === '/') {
			return page.url.pathname === '/' || page.url.pathname.startsWith('/session/');
		}
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
	style="padding-bottom: env(safe-area-inset-bottom)"
>
	<ul class="mx-auto grid max-w-lg grid-cols-4">
		{#each items as item (item.href)}
			<li>
				<a
					href={item.href}
					class="flex min-h-14 items-center justify-center text-sm font-semibold tracking-wide {active(
						item.href
					)
						? 'text-lime-300'
						: 'text-zinc-400'}"
				>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
</nav>
