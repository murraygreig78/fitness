<script lang="ts">
	import { parseDateOnly } from '$lib/week';

	export type TrendSeries = {
		id: string;
		name: string;
		points: number[];
		/** ISO dates aligned with points. */
		dates: string[];
		/** Human labels aligned with points (already formatted). */
		labels: string[];
	};

	let { series }: { series: TrendSeries[] } = $props();

	const width = 100;
	const height = 56;
	const padY = 4;

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
		min: number;
		max: number;
		points: { x: number; y: number; label: string; value: number; date: string }[];
		polyline: string;
		format: (value: number) => string;
	};

	function dayMs(value: string): number {
		return parseDateOnly(value).getTime();
	}

	function formatAxisDate(value: string): string {
		return parseDateOnly(value).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short'
		});
	}

	function lerp(min: number, max: number, t: number) {
		return min + (max - min) * t;
	}

	const plotted = $derived.by((): Plotted[] => {
		const usable = series.filter((item) => item.points.length > 1 && item.dates.length > 1);
		const allDates = usable.flatMap((item) => item.dates);
		if (!allDates.length) return [];
		const tMin = Math.min(...allDates.map(dayMs));
		const tMax = Math.max(...allDates.map(dayMs));
		const tSpan = tMax - tMin || 1;

		return usable.map((item, index) => {
			const min = Math.min(...item.points);
			const max = Math.max(...item.points);
			const span = max - min || 1;
			const points = item.points.map((value, pointIndex) => {
				const date = item.dates[pointIndex] ?? item.dates.at(-1) ?? item.dates[0];
				const x = ((dayMs(date) - tMin) / tSpan) * width;
				const y = padY + (1 - (value - min) / span) * (height - padY * 2);
				return {
					x,
					y,
					value,
					date,
					label: item.labels[pointIndex] ?? String(value)
				};
			});
			return {
				id: item.id,
				name: item.name,
				color: palette[index % palette.length],
				min,
				max,
				points,
				polyline: points.map((point) => `${point.x},${point.y}`).join(' '),
				format: (value: number) => {
					const nearest = points.reduce((best, point) =>
						Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best
					);
					if (Math.abs(nearest.value - value) < span * 0.0001) return nearest.label;
					const sample = points.at(-1)?.label ?? String(value);
					const rounded =
						Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
					return sample.replace(/-?\d+(\.\d+)?/, String(rounded));
				}
			};
		});
	});

	const timeDomain = $derived.by(() => {
		const dates = [
			...new Set(plotted.flatMap((line) => line.points.map((point) => point.date)))
		].sort((a, b) => a.localeCompare(b));
		if (!dates.length) return null;
		const tMin = dayMs(dates[0]);
		const tMax = dayMs(dates.at(-1)!);
		const tSpan = tMax - tMin || 1;
		const picks =
			dates.length <= 3
				? dates
				: [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates.at(-1)!];
		return [...new Set(picks)].map((date) => ({
			date,
			label: formatAxisDate(date),
			left: ((dayMs(date) - tMin) / tSpan) * 100
		}));
	});

	let tip = $state<{
		seriesId: string;
		name: string;
		label: string;
		color: string;
		x: number;
		y: number;
	} | null>(null);

	let frame: HTMLDivElement | undefined = $state();

	const active = $derived.by(() => {
		const current = tip;
		if (!current) return plotted[0];
		return plotted.find((line) => line.id === current.seriesId) ?? plotted[0];
	});

	const yTicks = $derived.by(() => {
		if (!active) return [];
		return [
			{ t: 1, label: active.format(lerp(active.min, active.max, 1)) },
			{ t: 0.5, label: active.format(lerp(active.min, active.max, 0.5)) },
			{ t: 0, label: active.format(lerp(active.min, active.max, 0)) }
		];
	});

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
			seriesId: string;
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
						seriesId: line.id,
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

		const thresholdPx = 36;
		if (best.distance > thresholdPx * thresholdPx) {
			clearTip();
			return;
		}

		tip = {
			seriesId: best.seriesId,
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
		class="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 px-3 pt-4 pb-3"
		role="img"
		aria-label="Activity trends over time. Press or drag to see a value."
	>
		<div class="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1">
			<div class="relative h-36 w-14 shrink-0">
				{#each yTicks as tick (tick.t)}
					<span
						class="absolute right-0 -translate-y-1/2 text-right font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
						style="top: {(1 - tick.t) * 100}%"
					>
						{tick.label}
					</span>
				{/each}
			</div>

			<div
				bind:this={frame}
				class="relative touch-manipulation overflow-hidden"
				role="presentation"
				onpointerdown={onPointer}
				onpointermove={onPointer}
				onpointerleave={clearTip}
				onpointercancel={clearTip}
			>
				<svg
					class="block h-36 w-full"
					viewBox="0 0 {width} {height}"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{#each [0, 0.5, 1] as t (t)}
						<line
							x1="0"
							x2={width}
							y1={padY + (1 - t) * (height - padY * 2)}
							y2={padY + (1 - t) * (height - padY * 2)}
							stroke="#3f3f46"
							stroke-width="0.35"
							vector-effect="non-scaling-stroke"
							opacity="0.7"
						/>
					{/each}
					{#each plotted as line (line.id)}
						<polyline
							fill="none"
							stroke={line.color}
							stroke-width="1.25"
							stroke-linecap="round"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
							opacity={tip && tip.seriesId !== line.id ? 0.35 : 0.95}
							points={line.polyline}
						/>
					{/each}
					{#if tip}
						<line
							x1={tip.x}
							x2={tip.x}
							y1={padY}
							y2={height - padY}
							stroke={tip.color}
							stroke-width="0.4"
							stroke-dasharray="1.5 1.5"
							vector-effect="non-scaling-stroke"
							opacity="0.8"
						/>
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
					{@const left = Math.min(Math.max(tip.x, 12), 88)}
					<div
						class="pointer-events-none absolute top-1 z-10 max-w-[90%] -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium text-zinc-950 shadow-sm"
						style="left: {left}%; background: {tip.color}"
					>
						<span class="truncate">{tip.name}</span>
						<span class="mx-1 opacity-50">·</span>
						<span class="font-mono tabular-nums">{tip.label}</span>
					</div>
				{/if}
			</div>

			<div></div>

			{#if timeDomain}
				<div class="relative h-4">
					{#each timeDomain as mark (mark.date)}
						<span
							class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
							style="left: {mark.left}%"
						>
							{mark.label}
						</span>
					{/each}
				</div>
			{/if}
		</div>

		{#if active && plotted.length > 1}
			<p class="mt-2 truncate text-[11px] text-zinc-500">
				Scale:
				<span style="color: {active.color}">{active.name}</span>
			</p>
		{/if}
	</div>
{/if}
