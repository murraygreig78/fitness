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
	const padX = 2;

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

	type Segment = {
		id: string;
		name: string;
		color: string;
		label: string;
		y0: number;
		y1: number;
	};

	type Column = {
		date: string;
		x: number;
		barWidth: number;
		count: number;
		segments: Segment[];
	};

	function dayMs(value: string): number {
		return parseDateOnly(value).getTime();
	}

	const colored = $derived(
		series
			.filter((item) => item.points.length > 0 && item.dates.length > 0)
			.map((item, index) => ({
				...item,
				color: palette[index % palette.length]!
			}))
	);

	const chart = $derived.by(() => {
		const dates = [
			...new Set(colored.flatMap((item) => item.dates))
		].sort((a, b) => a.localeCompare(b));
		if (!dates.length) {
			return { columns: [] as Column[], maxCount: 0, dates };
		}

		const plotLeft = padX;
		const plotRight = width - padX;
		const plotWidth = plotRight - plotLeft;
		const slot = dates.length > 0 ? plotWidth / dates.length : plotWidth;
		const barWidth = Math.min(slot * 0.72, 10);
		const plotBottom = height - padY;
		const plotTop = padY;
		const plotHeight = plotBottom - plotTop;

		const columns: Column[] = dates.map((date, index) => {
			const segmentsRaw = colored
				.map((item) => {
					const pointIndex = item.dates.findIndex((value) => value === date);
					if (pointIndex < 0) return null;
					return {
						id: item.id,
						name: item.name,
						color: item.color,
						label: item.labels[pointIndex] ?? String(item.points[pointIndex] ?? '')
					};
				})
				.filter((item): item is NonNullable<typeof item> => item != null);

			const count = segmentsRaw.length;
			const xCenter = plotLeft + slot * (index + 0.5);
			const segments: Segment[] = segmentsRaw.map((item, segmentIndex) => {
				const y1 = plotBottom - (segmentIndex / Math.max(count, 1)) * plotHeight;
				const y0 = plotBottom - ((segmentIndex + 1) / Math.max(count, 1)) * plotHeight;
				return { ...item, y0, y1 };
			});

			return {
				date,
				x: xCenter - barWidth / 2,
				barWidth,
				count,
				segments
			};
		});

		const maxCount = Math.max(1, ...columns.map((column) => column.count));
		// Re-scale segment heights against global max so Y = unique activity count
		for (const column of columns) {
			column.segments = column.segments.map((segment, segmentIndex) => {
				const y1 = plotBottom - (segmentIndex / maxCount) * plotHeight;
				const y0 = plotBottom - ((segmentIndex + 1) / maxCount) * plotHeight;
				return { ...segment, y0, y1 };
			});
		}

		return { columns, maxCount, dates };
	});

	const timeDomain = $derived.by(() => {
		const dates = chart.dates;
		if (dates.length < 1) return null;
		const plotLeft = padX;
		const plotRight = width - padX;
		const plotWidth = plotRight - plotLeft;
		const slot = dates.length > 0 ? plotWidth / dates.length : plotWidth;

		return dates.map((date, index) => {
			const parsed = parseDateOnly(date);
			const monthKey = `${parsed.getFullYear()}-${parsed.getMonth()}`;
			const previous = index > 0 ? parseDateOnly(dates[index - 1]!) : null;
			const previousKey = previous
				? `${previous.getFullYear()}-${previous.getMonth()}`
				: null;
			const xCenter = plotLeft + slot * (index + 0.5);
			return {
				key: `${date}:${index}`,
				day: String(parsed.getDate()),
				month:
					monthKey !== previousKey
						? parsed.toLocaleDateString(undefined, { month: 'short' })
						: null,
				left: (xCenter / width) * 100
			};
		});
	});

	const yTicks = $derived.by(() => {
		const maxCount = chart.maxCount;
		if (maxCount <= 0) return [];
		const values =
			maxCount <= 4 ? [...Array(maxCount + 1).keys()] : [0, Math.round(maxCount / 2), maxCount];
		const unique = [...new Set(values)].sort((a, b) => b - a);
		const plotBottom = height - padY;
		const plotHeight = height - padY * 2;
		return unique.map((count) => {
			const y = plotBottom - (count / maxCount) * plotHeight;
			return {
				count,
				label: String(count),
				top: (y / height) * 100
			};
		});
	});

	let tip = $state<{
		id: string;
		name: string;
		label: string;
		color: string;
		count: number;
		x: number;
		y: number;
	} | null>(null);

	let frame: HTMLDivElement | undefined = $state();

	function clearTip() {
		tip = null;
	}

	function onPointer(event: PointerEvent) {
		if (!frame || !chart.columns.length) {
			clearTip();
			return;
		}
		const rect = frame.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			clearTip();
			return;
		}
		const pointerX = ((event.clientX - rect.left) / rect.width) * width;
		const pointerY = ((event.clientY - rect.top) / rect.height) * height;

		let bestColumn: Column | null = null;
		let bestDx = Infinity;
		for (const column of chart.columns) {
			const center = column.x + column.barWidth / 2;
			const dx = Math.abs(center - pointerX);
			if (dx < bestDx) {
				bestDx = dx;
				bestColumn = column;
			}
		}
		if (!bestColumn || bestDx > Math.max(columnHitSlop(bestColumn), 8)) {
			clearTip();
			return;
		}

		let bestSegment = bestColumn.segments[0];
		for (const segment of bestColumn.segments) {
			if (pointerY <= segment.y1 && pointerY >= segment.y0) {
				bestSegment = segment;
				break;
			}
			const mid = (segment.y0 + segment.y1) / 2;
			const currentMid = bestSegment ? (bestSegment.y0 + bestSegment.y1) / 2 : mid;
			if (Math.abs(mid - pointerY) < Math.abs(currentMid - pointerY)) {
				bestSegment = segment;
			}
		}
		if (!bestSegment) {
			clearTip();
			return;
		}

		tip = {
			id: bestSegment.id,
			name: bestSegment.name,
			label: bestSegment.label,
			color: bestSegment.color,
			count: bestColumn.count,
			x: bestColumn.x + bestColumn.barWidth / 2,
			y: (bestSegment.y0 + bestSegment.y1) / 2
		};
	}

	function columnHitSlop(column: Column) {
		return column.barWidth * 1.4;
	}
</script>

{#if chart.columns.length}
	<div
		class="mb-6 rounded-3xl border border-zinc-800 bg-zinc-900/80 px-3 pt-4 pb-3"
		role="img"
		aria-label="Unique activities over time as a stacked bar chart. Press or drag to see a value."
	>
		<div class="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1">
			<div class="relative h-36 w-10 shrink-0">
				{#each yTicks as tick (tick.count)}
					<span
						class="absolute right-0 -translate-y-1/2 text-right font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
						style="top: {tick.top}%"
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
					{#each yTicks as tick (tick.count)}
						{@const y =
							height -
							padY -
							(tick.count / Math.max(chart.maxCount, 1)) * (height - padY * 2)}
						<line
							x1="0"
							x2={width}
							y1={y}
							y2={y}
							stroke="#3f3f46"
							stroke-width="0.35"
							vector-effect="non-scaling-stroke"
							opacity="0.7"
						/>
					{/each}
					{#each chart.columns as column (column.date)}
						{#each column.segments as segment (`${column.date}:${segment.id}`)}
							<rect
								x={column.x}
								y={segment.y0}
								width={column.barWidth}
								height={Math.max(segment.y1 - segment.y0, 0.4)}
								fill={segment.color}
								opacity={tip && tip.id !== segment.id ? 0.45 : 0.95}
								rx="0.6"
							/>
						{/each}
					{/each}
					{#if tip}
						<circle
							cx={tip.x}
							cy={tip.y}
							r="1.4"
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
				<div class="space-y-1">
					<div class="relative h-3">
						{#each timeDomain as mark (mark.key)}
							<span
								class="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-zinc-500 tabular-nums"
								style="left: {mark.left}%"
							>
								{mark.day}
							</span>
						{/each}
					</div>
					<div class="relative h-3">
						{#each timeDomain as mark (mark.key)}
							{#if mark.month}
								<span
									class="absolute -translate-x-1/2 text-[10px] leading-none text-zinc-500"
									style="left: {mark.left}%"
								>
									{mark.month}
								</span>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<p class="mt-2 text-[11px] text-zinc-500">Unique activities per day</p>
	</div>
{/if}
