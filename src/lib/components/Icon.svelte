<script lang="ts">
	export type IconName =
		| 'calendar'
		| 'stats'
		| 'plan'
		| 'heart'
		| 'dumbbell'
		| 'stretch'
		| 'plus'
		| 'chevronLeft'
		| 'chevronRight'
		| 'check'
		| 'skip'
		| 'play'
		| 'circle'
		| 'back'
		| 'timer'
		| 'stop'
		| 'pause'
		| 'admin';

	let {
		name,
		class: className = 'h-5 w-5'
	}: {
		name: IconName;
		class?: string;
	} = $props();
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'calendar'}
		<rect x="3" y="5" width="18" height="16" rx="2" />
		<path d="M3 10h18M8 3v4M16 3v4" />
	{:else if name === 'stats'}
		<path d="M4 19V9M12 19V5M20 19v-7" />
	{:else if name === 'plan'}
		<path d="M8 4h9a2 2 0 0 1 2 2v14l-4-2-4 2V6a2 2 0 0 1 2-2" />
		<path d="M8 4a2 2 0 0 0-2 2v14l4-2" />
	{:else if name === 'heart'}
		<path
			d="M19.5 12.6 12 20l-7.5-7.4a4.5 4.5 0 1 1 7.5-5.2 4.5 4.5 0 1 1 7.5 5.2Z"
		/>
	{:else if name === 'dumbbell'}
		<path d="M6.5 6.5v11M17.5 6.5v11M4 9.5v5M20 9.5v5M6.5 12h11" />
	{:else if name === 'stretch'}
		<circle cx="12" cy="5" r="2" />
		<path d="M7 21l5-8 5 8M9 11h6M8 14 5 12M16 14l3-2" />
	{:else if name === 'plus'}
		<path d="M12 5v14M5 12h14" />
	{:else if name === 'chevronLeft'}
		<path d="M15 5 8 12l7 7" />
	{:else if name === 'chevronRight'}
		<path d="M9 5l7 7-7 7" />
	{:else if name === 'check'}
		<circle cx="12" cy="12" r="9" />
		<path d="m8 12 2.8 2.8L16.5 9" />
	{:else if name === 'skip'}
		<circle cx="12" cy="12" r="9" />
		<path d="M8 12h8" />
	{:else if name === 'play'}
		<circle cx="12" cy="12" r="9" />
		<path d="M10 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
	{:else if name === 'circle'}
		<circle cx="12" cy="12" r="9" />
	{:else if name === 'back'}
		<path d="M15 5 8 12l7 7" />
	{:else if name === 'timer'}
		<circle cx="12" cy="13" r="8" />
		<path d="M12 9v4l2.5 1.5M9 3.5h6" />
	{:else if name === 'stop'}
		<circle cx="12" cy="12" r="9" />
		<rect x="8" y="8" width="8" height="8" rx="1.2" fill="currentColor" stroke="none" />
	{:else if name === 'pause'}
		<circle cx="12" cy="12" r="9" />
		<rect x="8.5" y="8" width="2.6" height="8" rx="0.6" fill="currentColor" stroke="none" />
		<rect x="12.9" y="8" width="2.6" height="8" rx="0.6" fill="currentColor" stroke="none" />
	{:else if name === 'admin'}
		<circle cx="12" cy="12" r="3" />
		<path
			d="M12 3.5v2.2M12 18.3V20.5M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M3.5 12h2.2M18.3 12H20.5M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"
		/>
	{/if}
</svg>
