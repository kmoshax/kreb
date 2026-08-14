export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };
export type Vector4 = { x: number; y: number; z: number; w: number };
export type Quaternion = Vector4;

/**
 * Index k holds raylib's field mK. raylib's struct declares its fields row by
 * row (m0, m4, m8, m12, then m1, ...), so this is deliberately NOT the struct's
 * memory order; it matches MatrixToFloatV and what a shader expects. Building a
 * Matrix from a C brace-initializer transposes it.
 */
export type Matrix = Float32Array;

/** Fixed-length view of a Matrix so literal indices type as number, not number | undefined. */
export type MatrixComponents = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];

export function components(mat: Matrix): MatrixComponents {
	return mat as unknown as MatrixComponents;
}

export const EPSILON = 0.000001;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
