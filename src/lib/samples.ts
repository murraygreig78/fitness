import { parsePlanJson } from './schema';
import { fitness } from './app-state.svelte';

export const APP_NAME = 'JSON Activity Tracker';
export const KOFI_URL = 'https://ko-fi.com/murraygreig';
export const REPO_URL = 'https://github.com/murraygreig78/fitness';

export type SamplePlanInfo = {
	id: string;
	file: string;
	name: string;
	daysLabel: string;
	level: string;
	summary: string;
};

export const starterPlans: SamplePlanInfo[] = [
	{
		id: 'home-dumbbell-week',
		file: '/plans/weekly.json',
		name: 'Home dumbbell week',
		daysLabel: '7 days a week',
		level: 'Home',
		summary:
			'Walks most days, dumbbell strength three times, mobility twice, a long run, and Sunday stats.'
	},
	{
		id: 'full-body-3-day',
		file: '/plans/full-body.json',
		name: 'Full-body routine',
		daysLabel: '3 days a week',
		level: 'Beginner',
		summary:
			'Work your whole body each session, with a rest day in between. Squats, push-ups, and rows to start.'
	},
	{
		id: 'upper-lower-4-day',
		file: '/plans/upper-lower.json',
		name: 'Upper / lower split',
		daysLabel: '4 days a week',
		level: 'Intermediate',
		summary:
			'Train the top half on some days and the bottom half on others, so you can do more work per session.'
	},
	{
		id: 'push-pull-legs-6-day',
		file: '/plans/push-pull-legs.json',
		name: 'Push / pull / legs',
		daysLabel: '6 days a week',
		level: 'Advanced',
		summary:
			'Group muscles by how they move: push (chest, shoulders, triceps), pull (back, biceps), then legs. Repeat the cycle twice.'
	}
];

export async function importSampleFromUrl(url: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) throw new Error('Sample plan was not found');
	const json: unknown = await response.json();
	const parsed = parsePlanJson(json);
	if ('error' in parsed) throw new Error(parsed.error);
	const result = await fitness.importPlan(parsed.plan);
	if (!result.ok) throw new Error(result.error);
}
