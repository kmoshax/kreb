import { components, EPSILON, type Matrix, type Quaternion, type Vector3 } from './types.ts';

export function Vector3Zero(): Vector3 {
	return { x: 0, y: 0, z: 0 };
}

export function Vector3One(): Vector3 {
	return { x: 1, y: 1, z: 1 };
}

export function Vector3Add(v1: Vector3, v2: Vector3): Vector3 {
	return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
}

export function Vector3AddValue(v: Vector3, add: number): Vector3 {
	return { x: v.x + add, y: v.y + add, z: v.z + add };
}

export function Vector3Subtract(v1: Vector3, v2: Vector3): Vector3 {
	return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
}

export function Vector3SubtractValue(v: Vector3, sub: number): Vector3 {
	return { x: v.x - sub, y: v.y - sub, z: v.z - sub };
}

export function Vector3Scale(v: Vector3, scalar: number): Vector3 {
	return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function Vector3Multiply(v1: Vector3, v2: Vector3): Vector3 {
	return { x: v1.x * v2.x, y: v1.y * v2.y, z: v1.z * v2.z };
}

export function Vector3CrossProduct(v1: Vector3, v2: Vector3): Vector3 {
	return {
		x: v1.y * v2.z - v1.z * v2.y,
		y: v1.z * v2.x - v1.x * v2.z,
		z: v1.x * v2.y - v1.y * v2.x,
	};
}

export function Vector3Perpendicular(v: Vector3): Vector3 {
	let min = Math.abs(v.x);
	let axis: Vector3 = { x: 1, y: 0, z: 0 };

	if (Math.abs(v.y) < min) {
		min = Math.abs(v.y);
		axis = { x: 0, y: 1, z: 0 };
	}

	if (Math.abs(v.z) < min) {
		axis = { x: 0, y: 0, z: 1 };
	}

	return Vector3CrossProduct(v, axis);
}

export function Vector3Length(v: Vector3): number {
	return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function Vector3LengthSqr(v: Vector3): number {
	return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function Vector3DotProduct(v1: Vector3, v2: Vector3): number {
	return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

export function Vector3Distance(v1: Vector3, v2: Vector3): number {
	const dx = v2.x - v1.x;
	const dy = v2.y - v1.y;
	const dz = v2.z - v1.z;

	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function Vector3DistanceSqr(v1: Vector3, v2: Vector3): number {
	const dx = v2.x - v1.x;
	const dy = v2.y - v1.y;
	const dz = v2.z - v1.z;

	return dx * dx + dy * dy + dz * dz;
}

export function Vector3Angle(v1: Vector3, v2: Vector3): number {
	const cross = Vector3CrossProduct(v1, v2);
	const length = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);

	return Math.atan2(length, Vector3DotProduct(v1, v2));
}

export function Vector3Negate(v: Vector3): Vector3 {
	return { x: -v.x, y: -v.y, z: -v.z };
}

export function Vector3Divide(v1: Vector3, v2: Vector3): Vector3 {
	return { x: v1.x / v2.x, y: v1.y / v2.y, z: v1.z / v2.z };
}

export function Vector3Normalize(v: Vector3): Vector3 {
	const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
	if (length === 0) return { x: v.x, y: v.y, z: v.z };

	const inverse = 1 / length;
	return { x: v.x * inverse, y: v.y * inverse, z: v.z * inverse };
}

export function Vector3Project(v1: Vector3, v2: Vector3): Vector3 {
	const magnitude = Vector3DotProduct(v1, v2) / Vector3DotProduct(v2, v2);

	return { x: v2.x * magnitude, y: v2.y * magnitude, z: v2.z * magnitude };
}

export function Vector3Reject(v1: Vector3, v2: Vector3): Vector3 {
	const magnitude = Vector3DotProduct(v1, v2) / Vector3DotProduct(v2, v2);

	return {
		x: v1.x - v2.x * magnitude,
		y: v1.y - v2.y * magnitude,
		z: v1.z - v2.z * magnitude,
	};
}

/** Mutates both vectors in place, matching raylib's pointer-taking signature. */
export function Vector3OrthoNormalize(v1: Vector3, v2: Vector3): void {
	const normalized = Vector3Normalize(v1);
	v1.x = normalized.x;
	v1.y = normalized.y;
	v1.z = normalized.z;

	const vn1 = Vector3Normalize(Vector3CrossProduct(v1, v2));
	const vn2 = Vector3CrossProduct(vn1, v1);

	v2.x = vn2.x;
	v2.y = vn2.y;
	v2.z = vn2.z;
}

export function Vector3Transform(v: Vector3, mat: Matrix): Vector3 {
	const m = components(mat);

	return {
		x: (m[0] as number) * v.x + (m[4] as number) * v.y + (m[8] as number) * v.z + (m[12] as number),
		y: (m[1] as number) * v.x + (m[5] as number) * v.y + (m[9] as number) * v.z + (m[13] as number),
		z:
			(m[2] as number) * v.x + (m[6] as number) * v.y + (m[10] as number) * v.z + (m[14] as number),
	};
}

export function Vector3RotateByQuaternion(v: Vector3, q: Quaternion): Vector3 {
	return {
		x:
			v.x * (q.x * q.x + q.w * q.w - q.y * q.y - q.z * q.z) +
			v.y * (2 * q.x * q.y - 2 * q.w * q.z) +
			v.z * (2 * q.x * q.z + 2 * q.w * q.y),
		y:
			v.x * (2 * q.w * q.z + 2 * q.x * q.y) +
			v.y * (q.w * q.w - q.x * q.x + q.y * q.y - q.z * q.z) +
			v.z * (-2 * q.w * q.x + 2 * q.y * q.z),
		z:
			v.x * (-2 * q.w * q.y + 2 * q.x * q.z) +
			v.y * (2 * q.w * q.x + 2 * q.y * q.z) +
			v.z * (q.w * q.w - q.x * q.x - q.y * q.y + q.z * q.z),
	};
}

export function Vector3RotateByAxisAngle(v: Vector3, axis: Vector3, angle: number): Vector3 {
	const unit = Vector3Normalize(axis);
	const half = angle / 2;

	const sin = Math.sin(half);
	const w: Vector3 = { x: unit.x * sin, y: unit.y * sin, z: unit.z * sin };
	const cos = Math.cos(half);

	const wv = Vector3CrossProduct(w, v);
	const wwv = Vector3CrossProduct(w, wv);

	const scaled = Vector3Scale(wv, cos * 2);
	const doubled = Vector3Scale(wwv, 2);

	return {
		x: v.x + scaled.x + doubled.x,
		y: v.y + scaled.y + doubled.y,
		z: v.z + scaled.z + doubled.z,
	};
}

export function Vector3MoveTowards(v: Vector3, target: Vector3, maxDistance: number): Vector3 {
	const dx = target.x - v.x;
	const dy = target.y - v.y;
	const dz = target.z - v.z;
	const value = dx * dx + dy * dy + dz * dz;

	if (value === 0 || (maxDistance >= 0 && value <= maxDistance * maxDistance)) return target;

	const distance = Math.sqrt(value);
	return {
		x: v.x + (dx / distance) * maxDistance,
		y: v.y + (dy / distance) * maxDistance,
		z: v.z + (dz / distance) * maxDistance,
	};
}

export function Vector3Lerp(v1: Vector3, v2: Vector3, amount: number): Vector3 {
	return {
		x: v1.x + amount * (v2.x - v1.x),
		y: v1.y + amount * (v2.y - v1.y),
		z: v1.z + amount * (v2.z - v1.z),
	};
}

export function Vector3CubicHermite(
	v1: Vector3,
	tangent1: Vector3,
	v2: Vector3,
	tangent2: Vector3,
	amount: number,
): Vector3 {
	const squared = amount * amount;
	const cubed = squared * amount;

	const a = 2 * cubed - 3 * squared + 1;
	const b = cubed - 2 * squared + amount;
	const c = -2 * cubed + 3 * squared;
	const d = cubed - squared;

	return {
		x: a * v1.x + b * tangent1.x + c * v2.x + d * tangent2.x,
		y: a * v1.y + b * tangent1.y + c * v2.y + d * tangent2.y,
		z: a * v1.z + b * tangent1.z + c * v2.z + d * tangent2.z,
	};
}

export function Vector3Reflect(v: Vector3, normal: Vector3): Vector3 {
	const dot = Vector3DotProduct(v, normal);

	return {
		x: v.x - 2 * normal.x * dot,
		y: v.y - 2 * normal.y * dot,
		z: v.z - 2 * normal.z * dot,
	};
}

export function Vector3Min(v1: Vector3, v2: Vector3): Vector3 {
	return {
		x: Math.min(v1.x, v2.x),
		y: Math.min(v1.y, v2.y),
		z: Math.min(v1.z, v2.z),
	};
}

export function Vector3Max(v1: Vector3, v2: Vector3): Vector3 {
	return {
		x: Math.max(v1.x, v2.x),
		y: Math.max(v1.y, v2.y),
		z: Math.max(v1.z, v2.z),
	};
}

export function Vector3Barycenter(p: Vector3, a: Vector3, b: Vector3, c: Vector3): Vector3 {
	const v0 = Vector3Subtract(b, a);
	const v1 = Vector3Subtract(c, a);
	const v2 = Vector3Subtract(p, a);

	const d00 = Vector3DotProduct(v0, v0);
	const d01 = Vector3DotProduct(v0, v1);
	const d11 = Vector3DotProduct(v1, v1);
	const d20 = Vector3DotProduct(v2, v0);
	const d21 = Vector3DotProduct(v2, v1);

	const denominator = d00 * d11 - d01 * d01;

	const y = (d11 * d20 - d01 * d21) / denominator;
	const z = (d00 * d21 - d01 * d20) / denominator;

	return { x: 1 - (z + y), y, z };
}

export function Vector3Invert(v: Vector3): Vector3 {
	return { x: 1 / v.x, y: 1 / v.y, z: 1 / v.z };
}

export function Vector3Clamp(v: Vector3, min: Vector3, max: Vector3): Vector3 {
	return {
		x: Math.min(max.x, Math.max(min.x, v.x)),
		y: Math.min(max.y, Math.max(min.y, v.y)),
		z: Math.min(max.z, Math.max(min.z, v.z)),
	};
}

export function Vector3ClampValue(v: Vector3, min: number, max: number): Vector3 {
	let length = v.x * v.x + v.y * v.y + v.z * v.z;
	if (length === 0) return { x: v.x, y: v.y, z: v.z };

	length = Math.sqrt(length);

	let scale = 1;
	if (length < min) scale = min / length;
	else if (length > max) scale = max / length;

	return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
}

export function Vector3Equals(p: Vector3, q: Vector3): boolean {
	return (
		Math.abs(p.x - q.x) <= EPSILON * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
		Math.abs(p.y - q.y) <= EPSILON * Math.max(1, Math.abs(p.y), Math.abs(q.y)) &&
		Math.abs(p.z - q.z) <= EPSILON * Math.max(1, Math.abs(p.z), Math.abs(q.z))
	);
}

export function Vector3Refract(v: Vector3, n: Vector3, r: number): Vector3 {
	const dot = Vector3DotProduct(v, n);
	let d = 1 - r * r * (1 - dot * dot);

	if (d < 0) return { x: 0, y: 0, z: 0 };

	d = Math.sqrt(d);
	return {
		x: r * v.x - (r * dot + d) * n.x,
		y: r * v.y - (r * dot + d) * n.y,
		z: r * v.z - (r * dot + d) * n.z,
	};
}

export function Vector3ToFloatV(v: Vector3): Float32Array {
	return new Float32Array([v.x, v.y, v.z]);
}
