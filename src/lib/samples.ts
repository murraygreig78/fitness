import { parsePlanJson } from './schema';
import { fitness } from './app-state.svelte';

export const APP_NAME = 'JSON Activity Tracker';
export const KOFI_URL = 'https://ko-fi.com/murraygreig';
export const REPO_URL = 'https://github.com/murraygreig78/fitness';

export type StarterEquipment = 'bodyweight' | 'dumbbell' | 'mixed';
export type StarterFocus = 'strength' | 'mobility' | 'cardio' | 'full';

export type SamplePlanInfo = {
	id: string;
	file: string;
	name: string;
	daysLabel: string;
	daysPerWeek: number;
	level: string;
	equipment: StarterEquipment;
	focus: StarterFocus;
	summary: string;
};

export const starterPlans: SamplePlanInfo[] = [
	{
		id: 'beginner-bodyweight-3day',
		file: '/plans/beginner-bodyweight.json',
		name: 'Beginner bodyweight',
		daysLabel: '3 days a week',
		daysPerWeek: 3,
		level: 'Beginner',
		equipment: 'bodyweight',
		focus: 'strength',
		summary:
			'No equipment. Wednesday plus both weekend days. Squats, push-ups, bridges, and short planks.'
	},
	{
		id: 'beginner-mobility-3day',
		file: '/plans/beginner-mobility.json',
		name: 'Beginner stretching',
		daysLabel: '3 days a week',
		daysPerWeek: 3,
		level: 'Beginner',
		equipment: 'bodyweight',
		focus: 'mobility',
		summary:
			'Gentle holds on Tuesday, Thursday, and Sunday. One-sided stretches use two sets so both sides get done.'
	},
	{
		id: 'daily-walk-cardio',
		file: '/plans/daily-walk.json',
		name: 'Daily walk',
		daysLabel: '7 days a week',
		daysPerWeek: 7,
		level: 'Home',
		equipment: 'bodyweight',
		focus: 'cardio',
		summary:
			'Easy 3km walk each day, plus a longer run on Saturday. Add this into a strength or stretch week.'
	},
	{
		id: 'home-dumbbell-week',
		file: '/plans/weekly.json',
		name: 'Home dumbbell week',
		daysLabel: '6 days a week',
		daysPerWeek: 6,
		level: 'Home',
		equipment: 'dumbbell',
		focus: 'full',
		summary:
			'Dumbbell strength three times, mobility twice, and Sunday body stats. Pair with Daily walk if you want cardio.'
	},
	{
		id: 'full-body-3-day',
		file: '/plans/full-body.json',
		name: 'Full-body routine',
		daysLabel: '3 days a week',
		daysPerWeek: 3,
		level: 'Beginner',
		equipment: 'dumbbell',
		focus: 'strength',
		summary:
			'Work your whole body each session, with a rest day in between. Squats, push-ups, and rows to start.'
	},
	{
		id: 'upper-lower-4-day',
		file: '/plans/upper-lower.json',
		name: 'Upper / lower split',
		daysLabel: '4 days a week',
		daysPerWeek: 4,
		level: 'Intermediate',
		equipment: 'dumbbell',
		focus: 'strength',
		summary:
			'Train the top half on some days and the bottom half on others, so you can do more work per session.'
	},
	{
		id: 'push-pull-legs-6-day',
		file: '/plans/push-pull-legs.json',
		name: 'Push / pull / legs',
		daysLabel: '6 days a week',
		daysPerWeek: 6,
		level: 'Advanced',
		equipment: 'dumbbell',
		focus: 'strength',
		summary:
			'Group muscles by how they move: push (chest, shoulders, triceps), pull (back, biceps), then legs. Repeat the cycle twice.'
	}
];

export type StarterEquipmentFilter = 'all' | StarterEquipment;
export type StarterDaysFilter = 'all' | 2 | 3 | 4 | 6 | 7;

export function filterStarterPlans(
	plans: SamplePlanInfo[],
	equipment: StarterEquipmentFilter,
	days: StarterDaysFilter
): SamplePlanInfo[] {
	return plans.filter((plan) => {
		const equipmentOk =
			equipment === 'all' ||
			plan.equipment === equipment ||
			(equipment === 'dumbbell' && plan.equipment === 'mixed');
		const daysOk = days === 'all' || plan.daysPerWeek === days;
		return equipmentOk && daysOk;
	});
}

export async function importSampleFromUrl(
	url: string,
	mode: 'replace' | 'merge' = 'replace'
): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) throw new Error('Sample plan was not found');
	const json: unknown = await response.json();
	const parsed = parsePlanJson(json);
	if ('error' in parsed) throw new Error(parsed.error);
	const result =
		mode === 'merge' ? await fitness.mergePlan(parsed.plan) : await fitness.importPlan(parsed.plan);
	if (!result.ok) throw new Error(result.error);
}
