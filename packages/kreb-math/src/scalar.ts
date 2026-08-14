import { EPSILON } from './types.ts';

export function Clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function Lerp(start: number, end: number, amount: number): number {
	return start + amount * (end - start);
}

export function Normalize(value: number, start: number, end: number): number {
	return (value - start) / (end - start);
}

export function Remap(
	value: number,
	inputStart: number,
	inputEnd: number,
	outputStart: number,
	outputEnd: number,
): number {
	return ((value - inputStart) / (inputEnd - inputStart)) * (outputEnd - outputStart) + outputStart;
}

export function Wrap(value: number, min: number, max: number): number {
	return value - (max - min) * Math.floor((value - min) / (max - min));
}

export function FloatEquals(x: number, y: number): boolean {
	return Math.abs(x - y) <= EPSILON * Math.max(1, Math.abs(x), Math.abs(y));
}
