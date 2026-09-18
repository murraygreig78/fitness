import { weekdays, type Weekday } from './schema';

const MS_PER_DAY = 86_400_000;

export function toDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function addDays(value: string, days: number): string {
	return toDateOnly(new Date(parseDateOnly(value).getTime() + days * MS_PER_DAY));
}

export function mondayOf(date = new Date()): string {
	const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const offset = (copy.getDay() + 6) % 7;
	copy.setDate(copy.getDate() - offset);
	return toDateOnly(copy);
}

export function shiftWeek(weekStart: string, weeks: number): string {
	return addDays(weekStart, weeks * 7);
}

export function weekdayFromIndex(index: number): Weekday {
	return weekdays[index] ?? 'monday';
}

export function indexFromWeekday(weekday: Weekday): number {
	return weekdays.indexOf(weekday);
}

export function dateForWeekday(weekStart: string, weekday: Weekday): string {
	return addDays(weekStart, indexFromWeekday(weekday));
}

export function weekdayLabel(weekday: Weekday, style: 'short' | 'long' = 'short'): string {
	const date = dateForWeekday('2026-01-05', weekday);
	return parseDateOnly(date).toLocaleDateString(undefined, {
		weekday: style
	});
}

export function formatDayHeading(dateValue: string): string {
	return parseDateOnly(dateValue).toLocaleDateString(undefined, {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

export function formatWeekRange(weekStart: string): string {
	const end = addDays(weekStart, 6);
	const startDate = parseDateOnly(weekStart);
	const endDate = parseDateOnly(end);
	const startText = startDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	const endText = endDate.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
	return `${startText} – ${endText}`;
}

export function isToday(dateValue: string): boolean {
	return dateValue === toDateOnly(new Date());
}

export function isSameWeek(weekStart: string, date = new Date()): boolean {
	return weekStart === mondayOf(date);
}
