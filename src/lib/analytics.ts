import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export type AnalyticsProps = Record<string, string | number | boolean | undefined | null>;

type GoatCountPayload = {
	path: string;
	title?: string;
	event: true;
	no_session?: boolean;
};

declare global {
	interface Window {
		goatcounter?: {
			count?: (vars?: Record<string, unknown>) => void;
			no_onload?: boolean;
			no_events?: boolean;
			allow_local?: boolean;
		};
	}
}

/**
 * GoatCounter count endpoint, e.g. https://yourcode.goatcounter.com/count
 * Empty disables analytics.
 */
export function goatcounterEndpoint(): string {
	return env.PUBLIC_GOATCOUNTER_ENDPOINT?.trim() ?? '';
}

export function analyticsEnabled(): boolean {
	return Boolean(goatcounterEndpoint());
}

export function goatcounterScriptSrc(): string {
	return env.PUBLIC_GOATCOUNTER_SRC?.trim() || 'https://gc.zgo.at/count.js';
}

export function displayMode(): 'standalone' | 'browser' {
	if (!browser) return 'browser';
	const media = window.matchMedia('(display-mode: standalone)').matches;
	const ios =
		'standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone);
	return media || ios ? 'standalone' : 'browser';
}

function cleanProps(props?: AnalyticsProps): Record<string, string> | undefined {
	if (!props) return undefined;
	const next: Record<string, string> = {};
	for (const [key, value] of Object.entries(props)) {
		if (value == null || value === '') continue;
		next[key] = String(value);
	}
	return Object.keys(next).length ? next : undefined;
}

function propsTitle(props?: AnalyticsProps): string | undefined {
	const cleaned = cleanProps(props);
	if (!cleaned) return undefined;
	return Object.entries(cleaned)
		.map(([key, value]) => `${key}=${value}`)
		.join(' ');
}

const pending: GoatCountPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | undefined;

function flushPending(): void {
	if (!browser || !window.goatcounter?.count) return;
	while (pending.length) {
		const next = pending.shift();
		if (!next) break;
		try {
			window.goatcounter.count(next);
		} catch {
			/* ignore blocked / unavailable analytics */
		}
	}
	if (flushTimer != null) {
		clearInterval(flushTimer);
		flushTimer = undefined;
	}
}

function enqueueOrSend(payload: GoatCountPayload): void {
	if (window.goatcounter?.count) {
		try {
			window.goatcounter.count(payload);
		} catch {
			/* ignore */
		}
		return;
	}
	pending.push(payload);
	if (flushTimer != null) return;
	flushTimer = setInterval(flushPending, 200);
}

/** Fire a GoatCounter event. No-ops when analytics is disabled or unavailable. */
export function track(event: string, props?: AnalyticsProps): void {
	if (!browser || !analyticsEnabled()) return;
	const path = event.replace(/^\//, '');
	if (!path) return;
	enqueueOrSend({
		path,
		title: propsTitle(props),
		event: true,
		no_session: true
	});
}

/** Call after the GoatCounter script loads so queued events flush promptly. */
export function flushAnalytics(): void {
	flushPending();
}
