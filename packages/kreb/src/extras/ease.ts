export type EaseFn = (t: number) => number;

const BACK = 1.70158;
const BOUNCE_N = 7.5625;
const BOUNCE_D = 2.75;

function outBounce(t: number): number {
	if (t < 1 / BOUNCE_D) return BOUNCE_N * t * t;
	if (t < 2 / BOUNCE_D) {
		const shifted = t - 1.5 / BOUNCE_D;
		return BOUNCE_N * shifted * shifted + 0.75;
	}
	if (t < 2.5 / BOUNCE_D) {
		const shifted = t - 2.25 / BOUNCE_D;
		return BOUNCE_N * shifted * shifted + 0.9375;
	}

	const shifted = t - 2.625 / BOUNCE_D;
	return BOUNCE_N * shifted * shifted + 0.984375;
}

export const Ease = {
	Linear: (t: number) => t,

	InQuad: (t: number) => t * t,
	OutQuad: (t: number) => 1 - (1 - t) * (1 - t),
	InOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),

	InCubic: (t: number) => t ** 3,
	OutCubic: (t: number) => 1 - (1 - t) ** 3,
	InOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),

	InSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
	OutSine: (t: number) => Math.sin((t * Math.PI) / 2),
	InOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

	InExpo: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
	OutExpo: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),

	InBack: (t: number) => (BACK + 1) * t ** 3 - BACK * t * t,
	OutBack: (t: number) => 1 + (BACK + 1) * (t - 1) ** 3 + BACK * (t - 1) ** 2,

	OutBounce: outBounce,
	InBounce: (t: number) => 1 - outBounce(1 - t),
} as const satisfies Record<string, EaseFn>;

export type EaseName = keyof typeof Ease;

export function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}

/** Channel-wise interpolation of two 0xRRGGBBAA colors. */
export function lerpColor(from: number, to: number, t: number): number {
	let out = 0;

	for (let shift = 24; shift >= 0; shift -= 8) {
		const a = (from >>> shift) & 0xff;
		const b = (to >>> shift) & 0xff;
		out = (out << 8) | (Math.round(lerp(a, b, t)) & 0xff);
	}

	return out >>> 0;
}
