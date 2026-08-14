import * as rl from '@kreb/raylib-sys/raylib';

const cache = new Map<string, number>();

/** Rough advance width per point of font size, used only before a font exists. */
const ESTIMATED_ADVANCE = 0.5;

/**
 * Cached because layout asks for the same strings every frame and each miss is
 * an FFI call into raylib's font metrics.
 *
 * raylib reports 0 until a window has loaded the default font. Estimating is
 * better than letting a widget collapse to nothing, and the zero is not cached,
 * so real metrics take over as soon as they exist.
 */
export function measureText(text: string, size: number): number {
	if (text.length === 0) return 0;

	const key = `${size}:${text}`;
	const cached = cache.get(key);
	if (cached !== undefined) return cached;

	const width = rl.MeasureText(text, size);
	if (width === 0) return Math.round(text.length * size * ESTIMATED_ADVANCE);

	cache.set(key, width);
	return width;
}

export function clearMeasureCache(): void {
	cache.clear();
}
