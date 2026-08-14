export const ALL_LAYERS = 0xffffffff;
export const DEFAULT_LAYER = 1;

/** Bit `index` as a layer value. Index must fit in a 32-bit mask. */
export function layer(index: number): number {
	if (!Number.isInteger(index) || index < 0 || index > 31) {
		throw new Error(`Layer index must be an integer in 0..31, got ${index}`);
	}

	return (1 << index) >>> 0;
}

export function layers(...values: number[]): number {
	return values.reduce((mask, value) => (mask | value) >>> 0, 0);
}

/**
 * Either side being interested is enough to report the pair, so a bullet that
 * watches for walls still fires its callback against a wall that watches
 * nothing.
 */
export function interested(aLayer: number, aMask: number, bLayer: number, bMask: number): boolean {
	return ((aMask & bLayer) | (bMask & aLayer)) !== 0;
}
