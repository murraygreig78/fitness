export function formatKg(value: number | undefined): string {
	if (value == null || Number.isNaN(value)) return '—';
	return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function formatNumber(value: number | undefined, digits = 1): string {
	if (value == null || Number.isNaN(value)) return '—';
	return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.0$/, '');
}

export function formatDuration(totalSeconds: number | undefined): string {
	if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—';
	const rounded = Math.max(0, Math.round(totalSeconds));
	const hours = Math.floor(rounded / 3600);
	const minutes = Math.floor((rounded % 3600) / 60);
	const seconds = rounded % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	if (rounded >= 60) {
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}
	return `${seconds}s`;
}

export function formatClock(totalSeconds: number): string {
	const rounded = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(rounded / 3600);
	const minutes = Math.floor((rounded % 3600) / 60);
	const seconds = rounded % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatMuscle(name: string): string {
	return name
		.replace(/([A-Z])/g, ' $1')
		.replace(/[-_]/g, ' ')
		.trim()
		.toLowerCase();
}

export function parseDraftNumber(draft: string): number | undefined {
	const normalised = draft.replace(',', '.').trim();
	if (!normalised) return undefined;
	const value = Number(normalised);
	return Number.isFinite(value) ? value : undefined;
}

export function formVideoSearchUrl(exerciseName: string): string {
	const query = `short explainer video how to do ${exerciseName} in good form`;
	return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
