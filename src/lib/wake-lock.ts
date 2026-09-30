/** Keeps the phone screen on while an in-app timer is running (when enabled). */

type WakeLockSentinelLike = {
	released: boolean;
	release: () => Promise<void>;
	addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
	wakeLock?: {
		request: (type: 'screen') => Promise<WakeLockSentinelLike>;
	};
};

let sentinel: WakeLockSentinelLike | null = null;
let desired = false;
let listening = false;

function supported(): boolean {
	return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function apply(): Promise<void> {
	if (!desired) {
		if (sentinel && !sentinel.released) {
			try {
				await sentinel.release();
			} catch {
				/* ignore */
			}
		}
		sentinel = null;
		return;
	}

	if (!supported() || typeof document === 'undefined' || document.visibilityState !== 'visible') {
		return;
	}
	if (sentinel && !sentinel.released) return;

	try {
		const nav = navigator as WakeLockNavigator;
		const next = await nav.wakeLock?.request('screen');
		if (!next) return;
		sentinel = next;
		next.addEventListener('release', () => {
			if (sentinel === next) sentinel = null;
		});
	} catch {
		/* denied, low power mode, unsupported context */
	}
}

function ensureVisibilityListener(): void {
	if (listening || typeof document === 'undefined') return;
	listening = true;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void apply();
	});
}

/** Request or release the screen wake lock. Re-acquires when the tab becomes visible again. */
export function setWakeLockDesired(next: boolean): void {
	desired = next;
	ensureVisibilityListener();
	void apply();
}
