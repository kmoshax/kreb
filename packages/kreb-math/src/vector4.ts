import type { Vector4 } from './types.ts';
import { EPSILON } from './types.ts';

export function Vector4Zero(): Vector4 {
	return { x: 0, y: 0, z: 0, w: 0 };
}

export function Vector4One(): Vector4 {
	return { x: 1, y: 1, z: 1, w: 1 };
}

export function Vector4Add(v1: Vector4, v2: Vector4): Vector4 {
	return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z, w: v1.w + v2.w };
}

export function Vector4AddValue(v: Vector4, add: number): Vector4 {
	return { x: v.x + add, y: v.y + add, z: v.z + add, w: v.w + add };
}

export function Vector4Subtract(v1: Vector4, v2: Vector4): Vector4 {
	return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z, w: v1.w - v2.w };
}

export function Vector4SubtractValue(v: Vector4, sub: number): Vector4 {
	return { x: v.x - sub, y: v.y - sub, z: v.z - sub, w: v.w - sub };
}

export function Vector4Length(v: Vector4): number {
	return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
}

export function Vector4LengthSqr(v: Vector4): number {
	return v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w;
}

export function Vector4DotProduct(v1: Vector4, v2: Vector4): number {
	return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z + v1.w * v2.w;
}

export function Vector4Distance(v1: Vector4, v2: Vector4): number {
	return Math.sqrt(
		(v1.x - v2.x) * (v1.x - v2.x) +
			(v1.y - v2.y) * (v1.y - v2.y) +
			(v1.z - v2.z) * (v1.z - v2.z) +
			(v1.w - v2.w) * (v1.w - v2.w),
	);
}

export function Vector4DistanceSqr(v1: Vector4, v2: Vector4): number {
	return (
		(v1.x - v2.x) * (v1.x - v2.x) +
		(v1.y - v2.y) * (v1.y - v2.y) +
		(v1.z - v2.z) * (v1.z - v2.z) +
		(v1.w - v2.w) * (v1.w - v2.w)
	);
}

export function Vector4Scale(v: Vector4, scale: number): Vector4 {
	return { x: v.x * scale, y: v.y * scale, z: v.z * scale, w: v.w * scale };
}

export function Vector4Multiply(v1: Vector4, v2: Vector4): Vector4 {
	return { x: v1.x * v2.x, y: v1.y * v2.y, z: v1.z * v2.z, w: v1.w * v2.w };
}

export function Vector4Negate(v: Vector4): Vector4 {
	return { x: -v.x, y: -v.y, z: -v.z, w: -v.w };
}

export function Vector4Divide(v1: Vector4, v2: Vector4): Vector4 {
	return { x: v1.x / v2.x, y: v1.y / v2.y, z: v1.z / v2.z, w: v1.w / v2.w };
}

export function Vector4Normalize(v: Vector4): Vector4 {
	const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z + v.w * v.w);
	if (length === 0) return { x: 0, y: 0, z: 0, w: 0 };

	const inverse = 1 / length;
	return { x: v.x * inverse, y: v.y * inverse, z: v.z * inverse, w: v.w * inverse };
}

export function Vector4Min(v1: Vector4, v2: Vector4): Vector4 {
	return {
		x: Math.min(v1.x, v2.x),
		y: Math.min(v1.y, v2.y),
		z: Math.min(v1.z, v2.z),
		w: Math.min(v1.w, v2.w),
	};
}

export function Vector4Max(v1: Vector4, v2: Vector4): Vector4 {
	return {
		x: Math.max(v1.x, v2.x),
		y: Math.max(v1.y, v2.y),
		z: Math.max(v1.z, v2.z),
		w: Math.max(v1.w, v2.w),
	};
}

export function Vector4Lerp(v1: Vector4, v2: Vector4, amount: number): Vector4 {
	return {
		x: v1.x + amount * (v2.x - v1.x),
		y: v1.y + amount * (v2.y - v1.y),
		z: v1.z + amount * (v2.z - v1.z),
		w: v1.w + amount * (v2.w - v1.w),
	};
}

export function Vector4MoveTowards(v: Vector4, target: Vector4, maxDistance: number): Vector4 {
	const dx = target.x - v.x;
	const dy = target.y - v.y;
	const dz = target.z - v.z;
	const dw = target.w - v.w;
	const value = dx * dx + dy * dy + dz * dz + dw * dw;

	if (value === 0 || (maxDistance >= 0 && value <= maxDistance * maxDistance)) return target;

	const distance = Math.sqrt(value);
	return {
		x: v.x + (dx / distance) * maxDistance,
		y: v.y + (dy / distance) * maxDistance,
		z: v.z + (dz / distance) * maxDistance,
		w: v.w + (dw / distance) * maxDistance,
	};
}

export function Vector4Invert(v: Vector4): Vector4 {
	return { x: 1 / v.x, y: 1 / v.y, z: 1 / v.z, w: 1 / v.w };
}

export function Vector4Equals(p: Vector4, q: Vector4): boolean {
	return (
		Math.abs(p.x - q.x) <= EPSILON * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
		Math.abs(p.y - q.y) <= EPSILON * Math.max(1, Math.abs(p.y), Math.abs(q.y)) &&
		Math.abs(p.z - q.z) <= EPSILON * Math.max(1, Math.abs(p.z), Math.abs(q.z)) &&
		Math.abs(p.w - q.w) <= EPSILON * Math.max(1, Math.abs(p.w), Math.abs(q.w))
	);
}
