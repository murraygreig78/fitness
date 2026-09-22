let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const Ctor =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	context ??= new Ctor();
	return context;
}

export async function unlockBeep(): Promise<void> {
	const ctx = audioContext();
	if (!ctx) return;
	if (ctx.state === 'suspended') await ctx.resume();
}

export function playRestBeep(): void {
	const ctx = audioContext();
	if (!ctx) return;
	void ctx.resume();
	const start = ctx.currentTime;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(880, start);
	osc.frequency.setValueAtTime(698, start + 0.14);
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(start);
	osc.stop(start + 0.4);
	try {
		navigator.vibrate?.([140, 70, 140]);
	} catch {
		/* vibration is optional */
	}
}
