import { browser } from '$app/environment';
import { DEFAULT_NOTIFICATION_TIME, type Activity, type Plan } from './schema';
import { toDateOnly, weekdayFromDate } from './week';

const NOTIFIED_DATE_KEY = 'fitness-plan-reminder-date';

let timer: ReturnType<typeof setTimeout> | undefined;

export function parseNotificationTime(value: string): { hours: number; minutes: number } | null {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
	if (!match) return null;
	return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function notificationTimeFromInput(value: string): string {
	const parsed = parseNotificationTime(value.slice(0, 5));
	if (!parsed) return DEFAULT_NOTIFICATION_TIME;
	return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
}

export function atNotificationTime(time: string, date: Date): Date {
	const parsed = parseNotificationTime(time) ?? { hours: 7, minutes: 0 };
	const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	next.setHours(parsed.hours, parsed.minutes, 0, 0);
	return next;
}

export function nextNotificationDate(time: string, from = new Date()): Date {
	const today = atNotificationTime(time, from);
	if (today.getTime() > from.getTime()) return today;
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	return tomorrow;
}

export function plannedActivitiesForDate(plan: Plan | null, date = new Date()): Activity[] {
	if (!plan) return [];
	const weekday = weekdayFromDate(toDateOnly(date));
	return plan.days.find((day) => day.weekday === weekday)?.activities ?? [];
}

export function reminderCopy(
	plan: Plan,
	date = new Date()
): { title: string; body: string } | null {
	const weekday = weekdayFromDate(toDateOnly(date));
	const day = plan.days.find((item) => item.weekday === weekday);
	if (!day?.activities.length) return null;
	return {
		title: day.name,
		body: day.activities.map((activity) => activity.name).join(' · ')
	};
}

export function notificationsSupported(): boolean {
	return browser && typeof Notification !== 'undefined';
}

export function reminderPermission(): NotificationPermission | 'unsupported' {
	if (!notificationsSupported()) return 'unsupported';
	return Notification.permission;
}

export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
	if (!notificationsSupported()) return 'unsupported';
	if (Notification.permission === 'granted') return 'granted';
	return Notification.requestPermission();
}

function alreadyNotified(date: Date): boolean {
	return localStorage.getItem(NOTIFIED_DATE_KEY) === toDateOnly(date);
}

function markNotified(date: Date) {
	localStorage.setItem(NOTIFIED_DATE_KEY, toDateOnly(date));
}

async function showReminder(plan: Plan, when: Date) {
	const copy = reminderCopy(plan, when);
	if (!copy) return;
	if (reminderPermission() !== 'granted') return;
	if (alreadyNotified(when)) return;
	try {
		new Notification(copy.title, { body: copy.body, tag: 'plan-reminder' });
		markNotified(when);
	} catch {
		/* permission can still be withdrawn between check and show */
	}
}

export function stopPlanReminder() {
	if (timer != null) {
		clearTimeout(timer);
		timer = undefined;
	}
}

export function startPlanReminder(getPlan: () => Plan | null) {
	stopPlanReminder();
	if (!browser) return;

	const arm = () => {
		const plan = getPlan();
		if (!plan) return;
		const time = plan.notificationTime || DEFAULT_NOTIFICATION_TIME;
		const now = new Date();
		const todayAt = atNotificationTime(time, now);
		if (now.getTime() >= todayAt.getTime()) {
			void showReminder(plan, now);
		}
		const next = nextNotificationDate(time, now);
		timer = setTimeout(() => {
			const current = getPlan();
			if (current) void showReminder(current, new Date());
			arm();
		}, Math.max(1_000, next.getTime() - Date.now()));
	};

	arm();
}
