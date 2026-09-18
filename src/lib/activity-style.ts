import type { ActivityKind, SessionStatus } from './schema';

export function kindDotClass(kind: ActivityKind): string {
	switch (kind) {
		case 'cardio':
			return 'bg-sky-400';
		case 'strength':
			return 'bg-amber-400';
		case 'mobility':
			return 'bg-violet-400';
		case 'progress':
			return 'bg-lime-400';
	}
}

export function kindTextClass(kind: ActivityKind): string {
	switch (kind) {
		case 'cardio':
			return 'text-sky-400';
		case 'strength':
			return 'text-amber-400';
		case 'mobility':
			return 'text-violet-400';
		case 'progress':
			return 'text-lime-400';
	}
}

export function kindIconName(kind: ActivityKind): 'heart' | 'dumbbell' | 'stretch' | 'stats' {
	switch (kind) {
		case 'cardio':
			return 'heart';
		case 'strength':
			return 'dumbbell';
		case 'mobility':
			return 'stretch';
		case 'progress':
			return 'stats';
	}
}

export function statusIconName(
	status: SessionStatus
): 'check' | 'skip' | 'play' | 'circle' {
	switch (status) {
		case 'done':
			return 'check';
		case 'skipped':
			return 'skip';
		case 'in-progress':
			return 'play';
		default:
			return 'circle';
	}
}
