import { QuaternionFromMatrix } from './quaternion.ts';
import { components, type Matrix, type Quaternion, type Vector3 } from './types.ts';
import {
	Vector3CrossProduct,
	Vector3DotProduct,
	Vector3Length,
	Vector3Negate,
	Vector3Normalize,
	Vector3RotateByQuaternion,
	Vector3Scale,
	Vector3Subtract,
} from './vector3.ts';

/**
 * Index k holds raylib's field mK. raylib's struct declares its fields row by
 * row (m0, m4, m8, m12, then m1, ...), so this is deliberately not the struct's
 * memory order; it matches MatrixToFloatV and what a shader expects.
 */
export function matrix(...values: number[]): Matrix {
	return new Float32Array(values);
}

export function MatrixIdentity(): Matrix {
	return matrix(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
}

export function MatrixDeterminant(mat: Matrix): number {
	const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] =
		components(mat);

	return (
		a30 * a21 * a12 * a03 -
		a20 * a31 * a12 * a03 -
		a30 * a11 * a22 * a03 +
		a10 * a31 * a22 * a03 +
		a20 * a11 * a32 * a03 -
		a10 * a21 * a32 * a03 -
		a30 * a21 * a02 * a13 +
		a20 * a31 * a02 * a13 +
		a30 * a01 * a22 * a13 -
		a00 * a31 * a22 * a13 -
		a20 * a01 * a32 * a13 +
		a00 * a21 * a32 * a13 +
		a30 * a11 * a02 * a23 -
		a10 * a31 * a02 * a23 -
		a30 * a01 * a12 * a23 +
		a00 * a31 * a12 * a23 +
		a10 * a01 * a32 * a23 -
		a00 * a11 * a32 * a23 -
		a20 * a11 * a02 * a33 +
		a10 * a21 * a02 * a33 +
		a20 * a01 * a12 * a33 -
		a00 * a21 * a12 * a33 -
		a10 * a01 * a22 * a33 +
		a00 * a11 * a22 * a33
	);
}

export function MatrixTrace(mat: Matrix): number {
	const m = components(mat);

	return m[0] + m[5] + m[10] + m[15];
}

export function MatrixTranspose(mat: Matrix): Matrix {
	const m = components(mat);

	return matrix(
		m[0],
		m[4],
		m[8],
		m[12],
		m[1],
		m[5],
		m[9],
		m[13],
		m[2],
		m[6],
		m[10],
		m[14],
		m[3],
		m[7],
		m[11],
		m[15],
	);
}

export function MatrixInvert(mat: Matrix): Matrix {
	const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] =
		components(mat);

	const b00 = a00 * a11 - a01 * a10;
	const b01 = a00 * a12 - a02 * a10;
	const b02 = a00 * a13 - a03 * a10;
	const b03 = a01 * a12 - a02 * a11;
	const b04 = a01 * a13 - a03 * a11;
	const b05 = a02 * a13 - a03 * a12;
	const b06 = a20 * a31 - a21 * a30;
	const b07 = a20 * a32 - a22 * a30;
	const b08 = a20 * a33 - a23 * a30;
	const b09 = a21 * a32 - a22 * a31;
	const b10 = a21 * a33 - a23 * a31;
	const b11 = a22 * a33 - a23 * a32;

	const invDet = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);

	return matrix(
		(a11 * b11 - a12 * b10 + a13 * b09) * invDet,
		(-a01 * b11 + a02 * b10 - a03 * b09) * invDet,
		(a31 * b05 - a32 * b04 + a33 * b03) * invDet,
		(-a21 * b05 + a22 * b04 - a23 * b03) * invDet,
		(-a10 * b11 + a12 * b08 - a13 * b07) * invDet,
		(a00 * b11 - a02 * b08 + a03 * b07) * invDet,
		(-a30 * b05 + a32 * b02 - a33 * b01) * invDet,
		(a20 * b05 - a22 * b02 + a23 * b01) * invDet,
		(a10 * b10 - a11 * b08 + a13 * b06) * invDet,
		(-a00 * b10 + a01 * b08 - a03 * b06) * invDet,
		(a30 * b04 - a31 * b02 + a33 * b00) * invDet,
		(-a20 * b04 + a21 * b02 - a23 * b00) * invDet,
		(-a10 * b09 + a11 * b07 - a12 * b06) * invDet,
		(a00 * b09 - a01 * b07 + a02 * b06) * invDet,
		(-a30 * b03 + a31 * b01 - a32 * b00) * invDet,
		(a20 * b03 - a21 * b01 + a22 * b00) * invDet,
	);
}

export function MatrixAdd(left: Matrix, right: Matrix): Matrix {
	const result = new Float32Array(16);
	for (let i = 0; i < 16; i += 1) result[i] = (left[i] as number) + (right[i] as number);

	return result;
}

export function MatrixSubtract(left: Matrix, right: Matrix): Matrix {
	const result = new Float32Array(16);
	for (let i = 0; i < 16; i += 1) result[i] = (left[i] as number) - (right[i] as number);

	return result;
}

export function MatrixMultiplyValue(mat: Matrix, value: number): Matrix {
	const result = new Float32Array(16);
	for (let i = 0; i < 16; i += 1) result[i] = (mat[i] as number) * value;

	return result;
}

export function MatrixMultiply(left: Matrix, right: Matrix): Matrix {
	const l = components(left);
	const r = components(right);

	return matrix(
		l[0] * r[0] + l[1] * r[4] + l[2] * r[8] + l[3] * r[12],
		l[0] * r[1] + l[1] * r[5] + l[2] * r[9] + l[3] * r[13],
		l[0] * r[2] + l[1] * r[6] + l[2] * r[10] + l[3] * r[14],
		l[0] * r[3] + l[1] * r[7] + l[2] * r[11] + l[3] * r[15],
		l[4] * r[0] + l[5] * r[4] + l[6] * r[8] + l[7] * r[12],
		l[4] * r[1] + l[5] * r[5] + l[6] * r[9] + l[7] * r[13],
		l[4] * r[2] + l[5] * r[6] + l[6] * r[10] + l[7] * r[14],
		l[4] * r[3] + l[5] * r[7] + l[6] * r[11] + l[7] * r[15],
		l[8] * r[0] + l[9] * r[4] + l[10] * r[8] + l[11] * r[12],
		l[8] * r[1] + l[9] * r[5] + l[10] * r[9] + l[11] * r[13],
		l[8] * r[2] + l[9] * r[6] + l[10] * r[10] + l[11] * r[14],
		l[8] * r[3] + l[9] * r[7] + l[10] * r[11] + l[11] * r[15],
		l[12] * r[0] + l[13] * r[4] + l[14] * r[8] + l[15] * r[12],
		l[12] * r[1] + l[13] * r[5] + l[14] * r[9] + l[15] * r[13],
		l[12] * r[2] + l[13] * r[6] + l[14] * r[10] + l[15] * r[14],
		l[12] * r[3] + l[13] * r[7] + l[14] * r[11] + l[15] * r[15],
	);
}

export function MatrixTranslate(x: number, y: number, z: number): Matrix {
	return matrix(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1);
}

export function MatrixRotate(axis: Vector3, angle: number): Matrix {
	let { x, y, z } = axis;

	const lengthSquared = x * x + y * y + z * z;
	if (lengthSquared !== 1 && lengthSquared !== 0) {
		const inverse = 1 / Math.sqrt(lengthSquared);
		x *= inverse;
		y *= inverse;
		z *= inverse;
	}

	const sin = Math.sin(angle);
	const cos = Math.cos(angle);
	const t = 1 - cos;

	return matrix(
		x * x * t + cos,
		y * x * t + z * sin,
		z * x * t - y * sin,
		0,
		x * y * t - z * sin,
		y * y * t + cos,
		z * y * t + x * sin,
		0,
		x * z * t + y * sin,
		y * z * t - x * sin,
		z * z * t + cos,
		0,
		0,
		0,
		0,
		1,
	);
}

export function MatrixRotateX(angle: number): Matrix {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return matrix(1, 0, 0, 0, 0, cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1);
}

export function MatrixRotateY(angle: number): Matrix {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return matrix(cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1);
}

export function MatrixRotateZ(angle: number): Matrix {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return matrix(cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
}

export function MatrixRotateXYZ(angle: Vector3): Matrix {
	const cosz = Math.cos(-angle.z);
	const sinz = Math.sin(-angle.z);
	const cosy = Math.cos(-angle.y);
	const siny = Math.sin(-angle.y);
	const cosx = Math.cos(-angle.x);
	const sinx = Math.sin(-angle.x);

	return matrix(
		cosz * cosy,
		cosz * siny * sinx - sinz * cosx,
		cosz * siny * cosx + sinz * sinx,
		0,
		sinz * cosy,
		sinz * siny * sinx + cosz * cosx,
		sinz * siny * cosx - cosz * sinx,
		0,
		-siny,
		cosy * sinx,
		cosy * cosx,
		0,
		0,
		0,
		0,
		1,
	);
}

export function MatrixRotateZYX(angle: Vector3): Matrix {
	const cz = Math.cos(angle.z);
	const sz = Math.sin(angle.z);
	const cy = Math.cos(angle.y);
	const sy = Math.sin(angle.y);
	const cx = Math.cos(angle.x);
	const sx = Math.sin(angle.x);

	return matrix(
		cz * cy,
		cy * sz,
		-sy,
		0,
		cz * sy * sx - cx * sz,
		cz * cx + sz * sy * sx,
		cy * sx,
		0,
		sz * sx + cz * cx * sy,
		cx * sz * sy - cz * sx,
		cy * cx,
		0,
		0,
		0,
		0,
		1,
	);
}

export function MatrixScale(x: number, y: number, z: number): Matrix {
	return matrix(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
}

export function MatrixFrustum(
	left: number,
	right: number,
	bottom: number,
	top: number,
	nearPlane: number,
	farPlane: number,
): Matrix {
	const rl = right - left;
	const tb = top - bottom;
	const fn = farPlane - nearPlane;

	return matrix(
		(nearPlane * 2) / rl,
		0,
		0,
		0,
		0,
		(nearPlane * 2) / tb,
		0,
		0,
		(right + left) / rl,
		(top + bottom) / tb,
		-(farPlane + nearPlane) / fn,
		-1,
		0,
		0,
		-(farPlane * nearPlane * 2) / fn,
		0,
	);
}

export function MatrixPerspective(
	fovY: number,
	aspect: number,
	nearPlane: number,
	farPlane: number,
): Matrix {
	const top = nearPlane * Math.tan(fovY * 0.5);
	const right = top * aspect;

	return MatrixFrustum(-right, right, -top, top, nearPlane, farPlane);
}

export function MatrixOrtho(
	left: number,
	right: number,
	bottom: number,
	top: number,
	nearPlane: number,
	farPlane: number,
): Matrix {
	const rl = right - left;
	const tb = top - bottom;
	const fn = farPlane - nearPlane;

	return matrix(
		2 / rl,
		0,
		0,
		0,
		0,
		2 / tb,
		0,
		0,
		0,
		0,
		-2 / fn,
		0,
		-(left + right) / rl,
		-(top + bottom) / tb,
		-(farPlane + nearPlane) / fn,
		1,
	);
}

export function MatrixLookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix {
	const vz = Vector3Normalize(Vector3Subtract(eye, target));
	const vx = Vector3Normalize(Vector3CrossProduct(up, vz));
	const vy = Vector3CrossProduct(vz, vx);

	return matrix(
		vx.x,
		vy.x,
		vz.x,
		0,
		vx.y,
		vy.y,
		vz.y,
		0,
		vx.z,
		vy.z,
		vz.z,
		0,
		-Vector3DotProduct(vx, eye),
		-Vector3DotProduct(vy, eye),
		-Vector3DotProduct(vz, eye),
		1,
	);
}

export function MatrixToFloatV(mat: Matrix): Float32Array {
	return new Float32Array(mat);
}

export function MatrixCompose(translation: Vector3, rotation: Quaternion, scale: Vector3): Matrix {
	const right = Vector3RotateByQuaternion(Vector3Scale({ x: 1, y: 0, z: 0 }, scale.x), rotation);
	const up = Vector3RotateByQuaternion(Vector3Scale({ x: 0, y: 1, z: 0 }, scale.y), rotation);
	const forward = Vector3RotateByQuaternion(Vector3Scale({ x: 0, y: 0, z: 1 }, scale.z), rotation);

	return matrix(
		right.x,
		right.y,
		right.z,
		0,
		up.x,
		up.y,
		up.z,
		0,
		forward.x,
		forward.y,
		forward.z,
		0,
		translation.x,
		translation.y,
		translation.z,
		1,
	);
}

export type Decomposition = {
	translation: Vector3;
	rotation: Quaternion;
	scale: Vector3;
};

export function MatrixDecompose(mat: Matrix): Decomposition {
	const eps = 1e-9;
	const m = components(mat);

	const translation: Vector3 = { x: m[12], y: m[13], z: m[14] };

	let columns: Vector3[] = [
		{ x: m[0], y: m[4], z: m[8] },
		{ x: m[1], y: m[5], z: m[9] },
		{ x: m[2], y: m[6], z: m[10] },
	];

	// Max-normalising first keeps the Gram-Schmidt pass numerically stable.
	let stabilizer = eps;
	for (const column of columns) {
		stabilizer = Math.max(stabilizer, Math.abs(column.x), Math.abs(column.y), Math.abs(column.z));
	}
	columns = columns.map((column) => Vector3Scale(column, 1 / stabilizer));

	const scale: Vector3 = { x: 0, y: 0, z: 0 };
	const shear = [0, 0, 0];

	scale.x = Vector3Length(columns[0] as Vector3);
	if (scale.x > eps) columns[0] = Vector3Scale(columns[0] as Vector3, 1 / scale.x);

	shear[0] = Vector3DotProduct(columns[0] as Vector3, columns[1] as Vector3);
	columns[1] = Vector3Subtract(
		columns[1] as Vector3,
		Vector3Scale(columns[0] as Vector3, shear[0] as number),
	);

	scale.y = Vector3Length(columns[1] as Vector3);
	if (scale.y > eps) columns[1] = Vector3Scale(columns[1] as Vector3, 1 / scale.y);

	shear[1] = Vector3DotProduct(columns[0] as Vector3, columns[2] as Vector3);
	columns[2] = Vector3Subtract(
		columns[2] as Vector3,
		Vector3Scale(columns[0] as Vector3, shear[1] as number),
	);
	shear[2] = Vector3DotProduct(columns[1] as Vector3, columns[2] as Vector3);
	columns[2] = Vector3Subtract(
		columns[2] as Vector3,
		Vector3Scale(columns[1] as Vector3, shear[2] as number),
	);

	scale.z = Vector3Length(columns[2] as Vector3);
	if (scale.z > eps) columns[2] = Vector3Scale(columns[2] as Vector3, 1 / scale.z);

	// Orthonormal at this point; flip if the basis is left handed so the
	// rotation stays a pure rotation rather than a reflection.
	const handedness = Vector3DotProduct(
		columns[0] as Vector3,
		Vector3CrossProduct(columns[1] as Vector3, columns[2] as Vector3),
	);

	let signedScale = scale;
	if (handedness < 0) {
		signedScale = Vector3Negate(scale);
		columns = columns.map(Vector3Negate);
	}

	// Column vectors go in by m-index: writing them row-wise would transpose the
	// matrix and yield the conjugate quaternion.
	const [c0, c1, c2] = columns as [Vector3, Vector3, Vector3];
	const rotationMatrix = matrix(
		c0.x,
		c1.x,
		c2.x,
		0,
		c0.y,
		c1.y,
		c2.y,
		0,
		c0.z,
		c1.z,
		c2.z,
		0,
		0,
		0,
		0,
		1,
	);

	return {
		translation,
		rotation: QuaternionFromMatrix(rotationMatrix),
		scale: Vector3Scale(signedScale, stabilizer),
	};
}

export function Vector3Unproject(source: Vector3, projection: Matrix, view: Matrix): Vector3 {
	const inverted = MatrixInvert(MatrixMultiply(view, projection));
	const m = components(inverted);

	const x = m[0] * source.x + m[4] * source.y + m[8] * source.z + m[12];
	const y = m[1] * source.x + m[5] * source.y + m[9] * source.z + m[13];
	const z = m[2] * source.x + m[6] * source.y + m[10] * source.z + m[14];
	const w = m[3] * source.x + m[7] * source.y + m[11] * source.z + m[15];

	return { x: x / w, y: y / w, z: z / w };
}
