import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export type AnalyticsProps = Record<string, string | number | boolean | undefined | null>;

declare global {
	interface Window {
		plausible?: (
			event: string,
			options?: {
				props?: Record<string, string>;
				callback?: () => void;
			}
		) => void;
	}
}

/** Hosted Plausible domain, e.g. murraygreig78.github.io — empty disables analytics. */
export function plausibleDomain(): string {
	return env.PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? '';
}

export function analyticsEnabled(): boolean {
	return Boolean(plausibleDomain());
}

export function plausibleScriptSrc(): string {
	return env.PUBLIC_PLAUSIBLE_SRC?.trim() || 'https://plausible.io/js/script.js';
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

/** Fire a Plausible custom event. No-ops when analytics is disabled or unavailable. */
export function track(event: string, props?: AnalyticsProps): void {
	if (!browser || !analyticsEnabled()) return;
	const cleaned = cleanProps(props);
	try {
		window.plausible?.(event, cleaned ? { props: cleaned } : undefined);
	} catch {
		/* ignore blocked / unavailable analytics */
	}
}
