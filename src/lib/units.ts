export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'km' | 'mi';

export type AppPreferences = {
	weightUnit: WeightUnit;
	distanceUnit: DistanceUnit;
	/** Keep the phone screen on while a rest or auto timer is running. */
	keepScreenAwake: boolean;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
	weightUnit: 'kg',
	distanceUnit: 'km',
	keepScreenAwake: true
};

const LB_PER_KG = 2.2046226218;
const MI_PER_KM = 0.6213711922;

export function weightUnitLabel(unit: WeightUnit): string {
	return unit === 'lb' ? 'lb' : 'kg';
}

export function distanceUnitLabel(unit: DistanceUnit): string {
	return unit === 'mi' ? 'mi' : 'km';
}

/** Stored kg → display value in the preferred unit. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
	return unit === 'lb' ? kg * LB_PER_KG : kg;
}

/** Display value → stored kg. */
export function displayToKg(value: number, unit: WeightUnit): number {
	return unit === 'lb' ? value / LB_PER_KG : value;
}

/** Stored km → display value in the preferred unit. */
export function kmToDisplay(km: number, unit: DistanceUnit): number {
	return unit === 'mi' ? km * MI_PER_KM : km;
}

/** Display value → stored km. */
export function displayToKm(value: number, unit: DistanceUnit): number {
	return unit === 'mi' ? value / MI_PER_KM : value;
}

export function formatWeight(kg: number | undefined, unit: WeightUnit): string {
	if (kg == null || Number.isNaN(kg)) return '—';
	const value = kgToDisplay(kg, unit);
	const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
	return `${text} ${weightUnitLabel(unit)}`;
}

export function formatDistance(km: number | undefined, unit: DistanceUnit, digits = 2): string {
	if (km == null || Number.isNaN(km)) return '—';
	const value = kmToDisplay(km, unit);
	const text = Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/\.0$/, '');
	return `${text} ${distanceUnitLabel(unit)}`;
}

/** Average pace as min per preferred distance unit, e.g. "6:30 /km". */
export function formatPace(
	distanceKm: number | undefined,
	durationSeconds: number | undefined,
	unit: DistanceUnit
): string | null {
	if (distanceKm == null || durationSeconds == null || distanceKm <= 0 || durationSeconds <= 0) {
		return null;
	}
	const displayDistance = kmToDisplay(distanceKm, unit);
	if (displayDistance <= 0) return null;
	const secondsPerUnit = durationSeconds / displayDistance;
	const minutes = Math.floor(secondsPerUnit / 60);
	const seconds = Math.round(secondsPerUnit % 60);
	const padded = String(seconds % 60).padStart(2, '0');
	return `${minutes}:${padded} /${distanceUnitLabel(unit)}`;
}

export const effortLevels = [
	{ value: 1, label: 'Easy' },
	{ value: 2, label: 'Steady' },
	{ value: 3, label: 'Moderate' },
	{ value: 4, label: 'Hard' },
	{ value: 5, label: 'Max' }
] as const;

export type EffortLevel = (typeof effortLevels)[number]['value'];

export function effortLabel(effort: number | undefined): string | null {
	if (effort == null) return null;
	return effortLevels.find((item) => item.value === effort)?.label ?? null;
}

export function normalizePreferences(input: unknown): AppPreferences {
	if (!input || typeof input !== 'object') return { ...DEFAULT_PREFERENCES };
	const record = input as Partial<AppPreferences>;
	return {
		weightUnit: record.weightUnit === 'lb' ? 'lb' : 'kg',
		distanceUnit: record.distanceUnit === 'mi' ? 'mi' : 'km',
		keepScreenAwake: record.keepScreenAwake === false ? false : true
	};
}
