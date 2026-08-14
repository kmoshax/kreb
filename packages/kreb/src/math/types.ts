export type Vector2 = { x: number; y: number };
export type Vector3 = { x: number; y: number; z: number };
export type Vector4 = { x: number; y: number; z: number; w: number };
export type Quaternion = Vector4;

/**
 * Sixteen floats in raylib's memory order, m0 through m15, so the array can be
 * handed to the binding layer without a conversion step.
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
