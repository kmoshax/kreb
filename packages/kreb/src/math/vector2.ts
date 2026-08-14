import { components, EPSILON, type Matrix, type Vector2 } from './types.ts';

export function Vector2Zero(): Vector2 {
	return { x: 0, y: 0 };
}

export function Vector2One(): Vector2 {
	return { x: 1, y: 1 };
}

export function Vector2Add(v1: Vector2, v2: Vector2): Vector2 {
	return { x: v1.x + v2.x, y: v1.y + v2.y };
}

export function Vector2AddValue(v: Vector2, add: number): Vector2 {
	return { x: v.x + add, y: v.y + add };
}

export function Vector2Subtract(v1: Vector2, v2: Vector2): Vector2 {
	return { x: v1.x - v2.x, y: v1.y - v2.y };
}

export function Vector2SubtractValue(v: Vector2, sub: number): Vector2 {
	return { x: v.x - sub, y: v.y - sub };
}

export function Vector2Length(v: Vector2): number {
	return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function Vector2LengthSqr(v: Vector2): number {
	return v.x * v.x + v.y * v.y;
}

export function Vector2DotProduct(v1: Vector2, v2: Vector2): number {
	return v1.x * v2.x + v1.y * v2.y;
}

export function Vector2CrossProduct(v1: Vector2, v2: Vector2): number {
	return v1.x * v2.y - v1.y * v2.x;
}

export function Vector2Distance(v1: Vector2, v2: Vector2): number {
	return Math.sqrt((v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y));
}

export function Vector2DistanceSqr(v1: Vector2, v2: Vector2): number {
	return (v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y);
}

export function Vector2Angle(v1: Vector2, v2: Vector2): number {
	const dot = v1.x * v2.x + v1.y * v2.y;
	const det = v1.x * v2.y - v1.y * v2.x;

	return Math.atan2(det, dot);
}

export function Vector2LineAngle(start: Vector2, end: Vector2): number {
	return -Math.atan2(end.y - start.y, end.x - start.x);
}

export function Vector2Scale(v: Vector2, scale: number): Vector2 {
	return { x: v.x * scale, y: v.y * scale };
}

export function Vector2Multiply(v1: Vector2, v2: Vector2): Vector2 {
	return { x: v1.x * v2.x, y: v1.y * v2.y };
}

export function Vector2Negate(v: Vector2): Vector2 {
	return { x: -v.x, y: -v.y };
}

export function Vector2Divide(v1: Vector2, v2: Vector2): Vector2 {
	return { x: v1.x / v2.x, y: v1.y / v2.y };
}

export function Vector2Normalize(v: Vector2): Vector2 {
	const length = Math.sqrt(v.x * v.x + v.y * v.y);
	if (length === 0) return { x: 0, y: 0 };

	const inverse = 1 / length;
	return { x: v.x * inverse, y: v.y * inverse };
}

export function Vector2Transform(v: Vector2, mat: Matrix): Vector2 {
	const m = components(mat);
	const z = 0;

	return {
		x: m[0] * v.x + m[4] * v.y + m[8] * z + m[12],
		y: m[1] * v.x + m[5] * v.y + m[9] * z + m[13],
	};
}

export function Vector2Lerp(v1: Vector2, v2: Vector2, amount: number): Vector2 {
	return {
		x: v1.x + amount * (v2.x - v1.x),
		y: v1.y + amount * (v2.y - v1.y),
	};
}

export function Vector2Reflect(v: Vector2, normal: Vector2): Vector2 {
	const dot = v.x * normal.x + v.y * normal.y;

	return {
		x: v.x - 2 * normal.x * dot,
		y: v.y - 2 * normal.y * dot,
	};
}

export function Vector2Min(v1: Vector2, v2: Vector2): Vector2 {
	return { x: Math.min(v1.x, v2.x), y: Math.min(v1.y, v2.y) };
}

export function Vector2Max(v1: Vector2, v2: Vector2): Vector2 {
	return { x: Math.max(v1.x, v2.x), y: Math.max(v1.y, v2.y) };
}

export function Vector2Rotate(v: Vector2, angle: number): Vector2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function Vector2MoveTowards(v: Vector2, target: Vector2, maxDistance: number): Vector2 {
	const dx = target.x - v.x;
	const dy = target.y - v.y;
	const value = dx * dx + dy * dy;

	if (value === 0 || (maxDistance >= 0 && value <= maxDistance * maxDistance)) return target;

	const distance = Math.sqrt(value);
	return {
		x: v.x + (dx / distance) * maxDistance,
		y: v.y + (dy / distance) * maxDistance,
	};
}

export function Vector2Invert(v: Vector2): Vector2 {
	return { x: 1 / v.x, y: 1 / v.y };
}

export function Vector2Clamp(v: Vector2, min: Vector2, max: Vector2): Vector2 {
	return {
		x: Math.min(max.x, Math.max(min.x, v.x)),
		y: Math.min(max.y, Math.max(min.y, v.y)),
	};
}

export function Vector2ClampValue(v: Vector2, min: number, max: number): Vector2 {
	const result = { x: v.x, y: v.y };
	let length = v.x * v.x + v.y * v.y;
	if (length === 0) return result;

	length = Math.sqrt(length);

	let scale = 1;
	if (length < min) scale = min / length;
	else if (length > max) scale = max / length;

	return { x: v.x * scale, y: v.y * scale };
}

export function Vector2Equals(p: Vector2, q: Vector2): boolean {
	return (
		Math.abs(p.x - q.x) <= EPSILON * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
		Math.abs(p.y - q.y) <= EPSILON * Math.max(1, Math.abs(p.y), Math.abs(q.y))
	);
}

export function Vector2Refract(v: Vector2, n: Vector2, r: number): Vector2 {
	const dot = v.x * n.x + v.y * n.y;
	let d = 1 - r * r * (1 - dot * dot);

	if (d < 0) return { x: 0, y: 0 };

	d = Math.sqrt(d);
	return {
		x: r * v.x - (r * dot + d) * n.x,
		y: r * v.y - (r * dot + d) * n.y,
	};
}
