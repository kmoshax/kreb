import { matrix } from './matrix.ts';
import { components, EPSILON, type Matrix, type Quaternion, type Vector3 } from './types.ts';

export function QuaternionIdentity(): Quaternion {
	return { x: 0, y: 0, z: 0, w: 1 };
}

export function QuaternionAdd(q1: Quaternion, q2: Quaternion): Quaternion {
	return { x: q1.x + q2.x, y: q1.y + q2.y, z: q1.z + q2.z, w: q1.w + q2.w };
}

export function QuaternionAddValue(q: Quaternion, add: number): Quaternion {
	return { x: q.x + add, y: q.y + add, z: q.z + add, w: q.w + add };
}

export function QuaternionSubtract(q1: Quaternion, q2: Quaternion): Quaternion {
	return { x: q1.x - q2.x, y: q1.y - q2.y, z: q1.z - q2.z, w: q1.w - q2.w };
}

export function QuaternionSubtractValue(q: Quaternion, sub: number): Quaternion {
	return { x: q.x - sub, y: q.y - sub, z: q.z - sub, w: q.w - sub };
}

export function QuaternionLength(q: Quaternion): number {
	return Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
}

export function QuaternionNormalize(q: Quaternion): Quaternion {
	let length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
	if (length === 0) length = 1;

	const inverse = 1 / length;
	return { x: q.x * inverse, y: q.y * inverse, z: q.z * inverse, w: q.w * inverse };
}

export function QuaternionInvert(q: Quaternion): Quaternion {
	const lengthSquared = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
	if (lengthSquared === 0) return { x: q.x, y: q.y, z: q.z, w: q.w };

	const inverse = 1 / lengthSquared;
	return { x: -q.x * inverse, y: -q.y * inverse, z: -q.z * inverse, w: q.w * inverse };
}

export function QuaternionMultiply(q1: Quaternion, q2: Quaternion): Quaternion {
	return {
		x: q1.x * q2.w + q1.w * q2.x + q1.y * q2.z - q1.z * q2.y,
		y: q1.y * q2.w + q1.w * q2.y + q1.z * q2.x - q1.x * q2.z,
		z: q1.z * q2.w + q1.w * q2.z + q1.x * q2.y - q1.y * q2.x,
		w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
	};
}

export function QuaternionScale(q: Quaternion, scale: number): Quaternion {
	return { x: q.x * scale, y: q.y * scale, z: q.z * scale, w: q.w * scale };
}

export function QuaternionDivide(q1: Quaternion, q2: Quaternion): Quaternion {
	return { x: q1.x / q2.x, y: q1.y / q2.y, z: q1.z / q2.z, w: q1.w / q2.w };
}

export function QuaternionLerp(q1: Quaternion, q2: Quaternion, amount: number): Quaternion {
	return {
		x: q1.x + amount * (q2.x - q1.x),
		y: q1.y + amount * (q2.y - q1.y),
		z: q1.z + amount * (q2.z - q1.z),
		w: q1.w + amount * (q2.w - q1.w),
	};
}

export function QuaternionNlerp(q1: Quaternion, q2: Quaternion, amount: number): Quaternion {
	return QuaternionNormalize(QuaternionLerp(q1, q2, amount));
}

export function QuaternionSlerp(q1: Quaternion, q2: Quaternion, amount: number): Quaternion {
	let cosHalfTheta = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
	let target = q2;

	if (cosHalfTheta < 0) {
		target = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
		cosHalfTheta = -cosHalfTheta;
	}

	if (Math.abs(cosHalfTheta) >= 1) return { x: q1.x, y: q1.y, z: q1.z, w: q1.w };
	if (cosHalfTheta > 0.95) return QuaternionNlerp(q1, target, amount);

	const halfTheta = Math.acos(cosHalfTheta);
	const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

	if (Math.abs(sinHalfTheta) < EPSILON) {
		return {
			x: q1.x * 0.5 + target.x * 0.5,
			y: q1.y * 0.5 + target.y * 0.5,
			z: q1.z * 0.5 + target.z * 0.5,
			w: q1.w * 0.5 + target.w * 0.5,
		};
	}

	const ratioA = Math.sin((1 - amount) * halfTheta) / sinHalfTheta;
	const ratioB = Math.sin(amount * halfTheta) / sinHalfTheta;

	return {
		x: q1.x * ratioA + target.x * ratioB,
		y: q1.y * ratioA + target.y * ratioB,
		z: q1.z * ratioA + target.z * ratioB,
		w: q1.w * ratioA + target.w * ratioB,
	};
}

export function QuaternionCubicHermiteSpline(
	q1: Quaternion,
	outTangent1: Quaternion,
	q2: Quaternion,
	inTangent2: Quaternion,
	t: number,
): Quaternion {
	const t2 = t * t;
	const t3 = t2 * t;

	const h00 = 2 * t3 - 3 * t2 + 1;
	const h10 = t3 - 2 * t2 + t;
	const h01 = -2 * t3 + 3 * t2;
	const h11 = t3 - t2;

	let result = QuaternionAdd(QuaternionScale(q1, h00), QuaternionScale(outTangent1, h10));
	result = QuaternionAdd(result, QuaternionScale(q2, h01));
	result = QuaternionAdd(result, QuaternionScale(inTangent2, h11));

	return QuaternionNormalize(result);
}

export function QuaternionFromVector3ToVector3(from: Vector3, to: Vector3): Quaternion {
	const cos2Theta = from.x * to.x + from.y * to.y + from.z * to.z;
	const cross = {
		x: from.y * to.z - from.z * to.y,
		y: from.z * to.x - from.x * to.z,
		z: from.x * to.y - from.y * to.x,
	};

	return QuaternionNormalize({
		x: cross.x,
		y: cross.y,
		z: cross.z,
		w:
			Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z + cos2Theta * cos2Theta) +
			cos2Theta,
	});
}

export function QuaternionFromMatrix(mat: Matrix): Quaternion {
	const m = components(mat);

	const fourWSquaredMinus1 = m[0] + m[5] + m[10];
	const fourXSquaredMinus1 = m[0] - m[5] - m[10];
	const fourYSquaredMinus1 = m[5] - m[0] - m[10];
	const fourZSquaredMinus1 = m[10] - m[0] - m[5];

	let biggestIndex = 0;
	let fourBiggestSquaredMinus1 = fourWSquaredMinus1;

	if (fourXSquaredMinus1 > fourBiggestSquaredMinus1) {
		fourBiggestSquaredMinus1 = fourXSquaredMinus1;
		biggestIndex = 1;
	}

	if (fourYSquaredMinus1 > fourBiggestSquaredMinus1) {
		fourBiggestSquaredMinus1 = fourYSquaredMinus1;
		biggestIndex = 2;
	}

	if (fourZSquaredMinus1 > fourBiggestSquaredMinus1) {
		fourBiggestSquaredMinus1 = fourZSquaredMinus1;
		biggestIndex = 3;
	}

	const biggest = Math.sqrt(fourBiggestSquaredMinus1 + 1) * 0.5;
	const mult = 0.25 / biggest;

	switch (biggestIndex) {
		case 0:
			return {
				w: biggest,
				x: (m[6] - m[9]) * mult,
				y: (m[8] - m[2]) * mult,
				z: (m[1] - m[4]) * mult,
			};
		case 1:
			return {
				x: biggest,
				w: (m[6] - m[9]) * mult,
				y: (m[1] + m[4]) * mult,
				z: (m[8] + m[2]) * mult,
			};
		case 2:
			return {
				y: biggest,
				w: (m[8] - m[2]) * mult,
				x: (m[1] + m[4]) * mult,
				z: (m[6] + m[9]) * mult,
			};
		default:
			return {
				z: biggest,
				w: (m[1] - m[4]) * mult,
				x: (m[8] + m[2]) * mult,
				y: (m[6] + m[9]) * mult,
			};
	}
}

export function QuaternionToMatrix(q: Quaternion): Matrix {
	const a2 = q.x * q.x;
	const b2 = q.y * q.y;
	const c2 = q.z * q.z;
	const ac = q.x * q.z;
	const ab = q.x * q.y;
	const bc = q.y * q.z;
	const ad = q.w * q.x;
	const bd = q.w * q.y;
	const cd = q.w * q.z;

	return matrix(
		1 - 2 * (b2 + c2),
		2 * (ab + cd),
		2 * (ac - bd),
		0,
		2 * (ab - cd),
		1 - 2 * (a2 + c2),
		2 * (bc + ad),
		0,
		2 * (ac + bd),
		2 * (bc - ad),
		1 - 2 * (a2 + b2),
		0,
		0,
		0,
		0,
		1,
	);
}

export function QuaternionFromAxisAngle(axis: Vector3, angle: number): Quaternion {
	const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
	if (length === 0) return QuaternionIdentity();

	const inverse = 1 / length;
	const half = angle * 0.5;
	const sin = Math.sin(half);

	return QuaternionNormalize({
		x: axis.x * inverse * sin,
		y: axis.y * inverse * sin,
		z: axis.z * inverse * sin,
		w: Math.cos(half),
	});
}

export type AxisAngle = { axis: Vector3; angle: number };

export function QuaternionToAxisAngle(q: Quaternion): AxisAngle {
	let source = q;
	if (Math.abs(q.w) > 1) source = QuaternionNormalize(q);

	const angle = 2 * Math.acos(source.w);
	const den = Math.sqrt(1 - source.w * source.w);

	if (den > EPSILON) {
		return { axis: { x: source.x / den, y: source.y / den, z: source.z / den }, angle };
	}

	// Zero rotation has no meaningful axis; raylib returns an arbitrary one.
	return { axis: { x: 1, y: 0, z: 0 }, angle };
}

export function QuaternionFromEuler(pitch: number, yaw: number, roll: number): Quaternion {
	const x0 = Math.cos(pitch * 0.5);
	const x1 = Math.sin(pitch * 0.5);
	const y0 = Math.cos(yaw * 0.5);
	const y1 = Math.sin(yaw * 0.5);
	const z0 = Math.cos(roll * 0.5);
	const z1 = Math.sin(roll * 0.5);

	return {
		x: x1 * y0 * z0 - x0 * y1 * z1,
		y: x0 * y1 * z0 + x1 * y0 * z1,
		z: x0 * y0 * z1 - x1 * y1 * z0,
		w: x0 * y0 * z0 + x1 * y1 * z1,
	};
}

export function QuaternionToEuler(q: Quaternion): Vector3 {
	const x0 = 2 * (q.w * q.x + q.y * q.z);
	const x1 = 1 - 2 * (q.x * q.x + q.y * q.y);

	let y0 = 2 * (q.w * q.y - q.z * q.x);
	y0 = Math.min(1, Math.max(-1, y0));

	const z0 = 2 * (q.w * q.z + q.x * q.y);
	const z1 = 1 - 2 * (q.y * q.y + q.z * q.z);

	return { x: Math.atan2(x0, x1), y: Math.asin(y0), z: Math.atan2(z0, z1) };
}

export function QuaternionTransform(q: Quaternion, mat: Matrix): Quaternion {
	const m = components(mat);

	return {
		x: m[0] * q.x + m[4] * q.y + m[8] * q.z + m[12] * q.w,
		y: m[1] * q.x + m[5] * q.y + m[9] * q.z + m[13] * q.w,
		z: m[2] * q.x + m[6] * q.y + m[10] * q.z + m[14] * q.w,
		w: m[3] * q.x + m[7] * q.y + m[11] * q.z + m[15] * q.w,
	};
}

export function QuaternionEquals(p: Quaternion, q: Quaternion): boolean {
	const sameSign =
		Math.abs(p.x - q.x) <= EPSILON * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
		Math.abs(p.y - q.y) <= EPSILON * Math.max(1, Math.abs(p.y), Math.abs(q.y)) &&
		Math.abs(p.z - q.z) <= EPSILON * Math.max(1, Math.abs(p.z), Math.abs(q.z)) &&
		Math.abs(p.w - q.w) <= EPSILON * Math.max(1, Math.abs(p.w), Math.abs(q.w));

	// q and -q represent the same rotation.
	const oppositeSign =
		Math.abs(p.x + q.x) <= EPSILON * Math.max(1, Math.abs(p.x), Math.abs(q.x)) &&
		Math.abs(p.y + q.y) <= EPSILON * Math.max(1, Math.abs(p.y), Math.abs(q.y)) &&
		Math.abs(p.z + q.z) <= EPSILON * Math.max(1, Math.abs(p.z), Math.abs(q.z)) &&
		Math.abs(p.w + q.w) <= EPSILON * Math.max(1, Math.abs(p.w), Math.abs(q.w));

	return sameSign || oppositeSign;
}
