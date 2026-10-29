<script lang="ts">
	export type TrendSeries = {
		id: string;
		name: string;
		points: number[];
		/** Human labels aligned with points (already formatted). */
		labels: string[];
	};

	let { series }: { series: TrendSeries[] } = $props();

	const width = 100;
	const height = 56;
	const padY = 6;

	const palette = [
		'#B8D4E8',
		'#D4C4E8',
		'#C8E6C9',
		'#FFE0B2',
		'#F8BBD0',
		'#B2DFDB',
		'#E1BEE7',
		'#DCEDC8',
		'#FFCCBC',
		'#B3E5FC',
		'#F0F4C3',
		'#D7CCC8'
	];

	type Plotted = {
		id: string;
		name: string;
		color: string;
		points: { x: number; y: number; label: string; value: number }[];
		polyline: string;
	};

	const plotted = $derived.by((): Plotted[] => {
		return series
			.filter((item) => item.points.length > 1)
			.map((item, index) => {
				const min = Math.min(...item.points);
				const max = Math.max(...item.points);
				const span = max - min || 1;
				const points = item.points.map((value, pointIndex) => {
					const x =
						item.points.length === 1
							? width / 2
							: (pointIndex / (item.points.length - 1)) * width;
					const y = padY + (1 - (value - min) / span) * (height - padY * 2);
					return {
						x,
						y,
						value,
						label: item.labels[pointIndex] ?? String(value)
					};
				});
				return {
					id: item.id,
					name: item.name,
					color: palette[index % palette.length],
					points,
					polyline: points.map((point) => `${point.x},${point.y}`).join(' ')
				};
			});
	});

	let tip = $state<{
		name: string;
		label: string;
		color: string;
		x: number;
		y: number;
	} | null>(null);

	let frame: HTMLDivElement | undefined = $state();

	function clearTip() {
		tip = null;
	}

	function onPointer(event: PointerEvent) {
		if (!frame || !plotted.length) {
			clearTip();
			return;
		}
		const rect = frame.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			clearTip();
			return;
		}
		const pointerX = event.clientX - rect.left;
		const pointerY = event.clientY - rect.top;

		let best: {
			name: string;
			label: string;
			color: string;
			distance: number;
			x: number;
			y: number;
		} | null = null;

		for (const line of plotted) {
			for (const point of line.points) {
				const screenX = (point.x / width) * rect.width;
				const screenY = (point.y / height) * rect.height;
				const dx = screenX - pointerX;
				const dy = screenY - pointerY;
				const distance = dx * dx + dy * dy;
				if (!best || distance < best.distance) {
					best = {
						name: line.name,
						label: point.label,
						color: line.color,
						distance,
						x: point.x,
						y: point.y
					};
				}
			}
		}

		if (!best) {
			clearTip();
			return;
		}

		// Ignore far away presses so the chart stays quiet
		const thresholdPx = 28;
		if (best.distance > thresholdPx * thresholdPx) {
			clearTip();
			return;
		}

		tip = {
			name: best.name,
			label: best.label,
			color: best.color,
			x: best.x,
			y: best.y
		};
	}
</script>

{#if plotted.length}
	<div
		bind:this={frame}
		class="relative mb-6 touch-manipulation overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 px-3 py-4"
		onpointerdown={onPointer}
		onpointermove={onPointer}
		onpointerleave={clearTip}
		onpointercancel={clearTip}
		role="img"
		aria-label="Activity trends over time. Press or drag to see a value."
	>
		<svg
			class="block h-36 w-full"
			viewBox="0 0 {width} {height}"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			{#each plotted as line (line.id)}
				<polyline
					fill="none"
					stroke={line.color}
					stroke-width="1.25"
					stroke-linecap="round"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
					opacity="0.9"
					points={line.polyline}
				/>
			{/each}
			{#if tip}
				<circle
					cx={tip.x}
					cy={tip.y}
					r="1.6"
					fill={tip.color}
					stroke="#18181b"
					stroke-width="0.5"
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		</svg>

		{#if tip}
			{@const left = Math.min(Math.max(tip.x, 8), 92)}
			<div
				class="pointer-events-none absolute top-2 z-10 max-w-[85%] -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium text-zinc-950 shadow-sm"
				style="left: {left}%; background: {tip.color}"
			>
				<span class="truncate">{tip.name}</span>
				<span class="mx-1 opacity-50">·</span>
				<span class="font-mono tabular-nums">{tip.label}</span>
			</div>
		{/if}
	</div>
{/if}
