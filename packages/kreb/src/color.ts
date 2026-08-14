export * from '@kreb/raylib-sys/colors';

/** Colors are packed 0xRRGGBBAA, the same convention raylib's GetColor uses. */
export function rgba(r: number, g: number, b: number, a = 255): number {
	return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
}

/** `hex(0x4f8cf7)` reads like CSS; alpha defaults to opaque. */
export function hex(value: number, alpha = 255): number {
	return (((value & 0xffffff) << 8) | alpha) >>> 0;
}

export function fade(color: number, alpha: number): number {
	const clamped = Math.min(Math.max(alpha, 0), 1);

	return ((color & 0xffffff00) | (Math.round(clamped * 255) & 0xff)) >>> 0;
}

export function withAlpha(color: number, alpha: number): number {
	return ((color & 0xffffff00) | (alpha & 0xff)) >>> 0;
}
