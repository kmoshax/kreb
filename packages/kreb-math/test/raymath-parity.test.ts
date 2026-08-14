// Tolerance is loose because raymath computes in float while JavaScript computes
// in double; the port is expected to match to single-precision, not bit-exactly.

import { type FFIFunction, ptr } from 'bun:ffi';
import { beforeAll, expect, test } from 'bun:test';
import * as km from '@kreb/math';
import type { Matrix, Quaternion, Vector2, Vector3 } from '@kreb/math/types';
import { buildShim } from '@kreb/raylib-sys/build';
import { loadShim } from '@kreb/raylib-sys/loader';
import { RAYMATH_PROBE_SOURCE } from '@kreb/raylib-sys/shim-path';

const f = 'f32';
const p = 'ptr';
const d = 'f64';

const symbols = {
	rm_Clamp: { args: [f, f, f], returns: f },
	rm_Lerp: { args: [f, f, f], returns: f },
	rm_Normalize: { args: [f, f, f], returns: f },
	rm_Wrap: { args: [f, f, f], returns: f },
	rm_Remap: { args: [f, f, f, f, f], returns: f },
	rm_FloatEquals: { args: [f, f], returns: 'i32' },
	rm_Vector2Angle: { args: [f, f, f, f], returns: f },
	rm_Vector2LineAngle: { args: [f, f, f, f], returns: f },
	rm_Vector2Rotate: { args: [f, f, f, p], returns: 'void' },
	rm_Vector2Refract: { args: [f, f, f, f, f, p], returns: 'void' },
	rm_Vector2MoveTowards: { args: [f, f, f, f, f, p], returns: 'void' },
	rm_Vector2ClampValue: { args: [f, f, f, f, p], returns: 'void' },
	rm_Vector2Reflect: { args: [f, f, f, f, p], returns: 'void' },
	rm_Vector2Transform: { args: [f, f, p, p], returns: 'void' },
	rm_Vector3Perpendicular: { args: [f, f, f, p], returns: 'void' },
	rm_Vector3Angle: { args: [f, f, f, f, f, f], returns: f },
	rm_Vector3RotateByAxisAngle: { args: [f, f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3RotateByQuaternion: { args: [f, f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3Barycenter: { args: [f, f, f, f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3Refract: { args: [f, f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3OrthoNormalize: { args: [f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3Project: { args: [f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3Reject: { args: [f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3CubicHermite: { args: [f, f, f, f, f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_Vector3Transform: { args: [f, f, f, p, p], returns: 'void' },
	rm_Vector3Unproject: { args: [f, f, f, p, p, p], returns: 'void' },
	rm_Vector3ClampValue: { args: [f, f, f, f, f, p], returns: 'void' },
	rm_Vector3MoveTowards: { args: [f, f, f, f, f, f, f, p], returns: 'void' },
	rm_MatrixDeterminant: { args: [p], returns: f },
	rm_MatrixTrace: { args: [p], returns: f },
	rm_MatrixTranspose: { args: [p, p], returns: 'void' },
	rm_MatrixInvert: { args: [p, p], returns: 'void' },
	rm_MatrixMultiply: { args: [p, p, p], returns: 'void' },
	rm_MatrixTranslate: { args: [f, f, f, p], returns: 'void' },
	rm_MatrixScale: { args: [f, f, f, p], returns: 'void' },
	rm_MatrixRotate: { args: [f, f, f, f, p], returns: 'void' },
	rm_MatrixRotateX: { args: [f, p], returns: 'void' },
	rm_MatrixRotateY: { args: [f, p], returns: 'void' },
	rm_MatrixRotateZ: { args: [f, p], returns: 'void' },
	rm_MatrixRotateXYZ: { args: [f, f, f, p], returns: 'void' },
	rm_MatrixRotateZYX: { args: [f, f, f, p], returns: 'void' },
	rm_MatrixFrustum: { args: [d, d, d, d, d, d, p], returns: 'void' },
	rm_MatrixPerspective: { args: [d, d, d, d, p], returns: 'void' },
	rm_MatrixOrtho: { args: [d, d, d, d, d, d, p], returns: 'void' },
	rm_MatrixLookAt: { args: [f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_MatrixCompose: { args: [f, f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_MatrixDecompose: { args: [p, p], returns: 'void' },
	rm_QuaternionMultiply: { args: [f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_QuaternionInvert: { args: [f, f, f, f, p], returns: 'void' },
	rm_QuaternionNlerp: { args: [f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_QuaternionSlerp: { args: [f, f, f, f, f, f, f, f, f, p], returns: 'void' },
	rm_QuaternionCubicHermiteSpline: {
		args: [f, f, f, f, f, f, f, f, f, f, f, f, f, f, f, f, f, p],
		returns: 'void',
	},
	rm_QuaternionFromVector3ToVector3: { args: [f, f, f, f, f, f, p], returns: 'void' },
	rm_QuaternionFromMatrix: { args: [p, p], returns: 'void' },
	rm_QuaternionToMatrix: { args: [f, f, f, f, p], returns: 'void' },
	rm_QuaternionFromAxisAngle: { args: [f, f, f, f, p], returns: 'void' },
	rm_QuaternionToAxisAngle: { args: [f, f, f, f, p], returns: 'void' },
	rm_QuaternionFromEuler: { args: [f, f, f, p], returns: 'void' },
	rm_QuaternionToEuler: { args: [f, f, f, f, p], returns: 'void' },
	rm_QuaternionTransform: { args: [f, f, f, f, p, p], returns: 'void' },
} satisfies Record<string, FFIFunction>;

let c: ReturnType<typeof loadShim<typeof symbols>>;

const out = new Float32Array(16);
const outPtr = ptr(out);

beforeAll(async () => {
	await buildShim([RAYMATH_PROBE_SOURCE], 'kreb_raymath_probe');

	c = loadShim('kreb_raymath_probe', symbols);
});

const TOLERANCE = 1e-5;

function expectClose(actual: number, expected: number, label: string): void {
	const scale = Math.max(1, Math.abs(expected));
	expect(Math.abs(actual - expected) / scale, `${label}: ${actual} vs ${expected}`).toBeLessThan(
		TOLERANCE,
	);
}

function expectSame(actual: readonly number[] | Float32Array, count: number, label: string): void {
	for (let i = 0; i < count; i += 1) {
		expectClose(Number(actual[i]), Number(out[i]), `${label}[${i}]`);
	}
}

const v2 = (v: Vector2) => [v.x, v.y];
const v3 = (v: Vector3) => [v.x, v.y, v.z];
const v4 = (v: Quaternion) => [v.x, v.y, v.z, v.w];

const SAMPLE: Matrix = km.MatrixMultiply(
	km.MatrixMultiply(km.MatrixRotateXYZ({ x: 0.3, y: -0.7, z: 1.1 }), km.MatrixScale(2, 3, 0.5)),
	km.MatrixTranslate(4, -5, 6),
);

test('scalar helpers', () => {
	expectClose(km.Clamp(5, 1, 3), c.rm_Clamp(5, 1, 3), 'Clamp');
	expectClose(km.Lerp(2, 8, 0.25), c.rm_Lerp(2, 8, 0.25), 'Lerp');
	expectClose(km.Normalize(5, 2, 10), c.rm_Normalize(5, 2, 10), 'Normalize');
	expectClose(km.Wrap(370, 0, 360), c.rm_Wrap(370, 0, 360), 'Wrap');
	expectClose(km.Wrap(-30, 0, 360), c.rm_Wrap(-30, 0, 360), 'Wrap negative');
	expectClose(km.Remap(5, 0, 10, 100, 200), c.rm_Remap(5, 0, 10, 100, 200), 'Remap');

	expect(km.FloatEquals(1, 1 + 1e-9)).toBe(c.rm_FloatEquals(1, 1 + 1e-9) === 1);
	expect(km.FloatEquals(1, 1.5)).toBe(c.rm_FloatEquals(1, 1.5) === 1);
});

test('Vector2 angles', () => {
	expectClose(
		km.Vector2Angle({ x: 1, y: 2 }, { x: -3, y: 4 }),
		c.rm_Vector2Angle(1, 2, -3, 4),
		'Angle',
	);
	expectClose(
		km.Vector2LineAngle({ x: 1, y: 2 }, { x: -3, y: 4 }),
		c.rm_Vector2LineAngle(1, 2, -3, 4),
		'LineAngle',
	);
});

test('Vector2 transforms', () => {
	c.rm_Vector2Rotate(3, -4, 0.9, outPtr);
	expectSame(v2(km.Vector2Rotate({ x: 3, y: -4 }, 0.9)), 2, 'Rotate');

	const n = km.Vector2Normalize({ x: 0.3, y: 0.9 });
	c.rm_Vector2Refract(0.6, -0.8, n.x, n.y, 0.7, outPtr);
	expectSame(v2(km.Vector2Refract({ x: 0.6, y: -0.8 }, n, 0.7)), 2, 'Refract');

	c.rm_Vector2MoveTowards(1, 2, 9, -3, 2.5, outPtr);
	expectSame(v2(km.Vector2MoveTowards({ x: 1, y: 2 }, { x: 9, y: -3 }, 2.5)), 2, 'MoveTowards');

	c.rm_Vector2ClampValue(3, 4, 1, 2, outPtr);
	expectSame(v2(km.Vector2ClampValue({ x: 3, y: 4 }, 1, 2)), 2, 'ClampValue');

	c.rm_Vector2Reflect(1, -2, n.x, n.y, outPtr);
	expectSame(v2(km.Vector2Reflect({ x: 1, y: -2 }, n)), 2, 'Reflect');

	c.rm_Vector2Transform(1.5, -2.5, ptr(SAMPLE), outPtr);
	expectSame(v2(km.Vector2Transform({ x: 1.5, y: -2.5 }, SAMPLE)), 2, 'Transform');
});

test('Vector3 geometry', () => {
	c.rm_Vector3Perpendicular(0.3, -2, 5, outPtr);
	expectSame(v3(km.Vector3Perpendicular({ x: 0.3, y: -2, z: 5 })), 3, 'Perpendicular');

	expectClose(
		km.Vector3Angle({ x: 1, y: 2, z: 3 }, { x: -4, y: 5, z: 6 }),
		c.rm_Vector3Angle(1, 2, 3, -4, 5, 6),
		'Angle',
	);

	c.rm_Vector3Project(1, 2, 3, -4, 5, 6, outPtr);
	expectSame(v3(km.Vector3Project({ x: 1, y: 2, z: 3 }, { x: -4, y: 5, z: 6 })), 3, 'Project');

	c.rm_Vector3Reject(1, 2, 3, -4, 5, 6, outPtr);
	expectSame(v3(km.Vector3Reject({ x: 1, y: 2, z: 3 }, { x: -4, y: 5, z: 6 })), 3, 'Reject');

	c.rm_Vector3Barycenter(0.2, 0.3, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, outPtr);
	expectSame(
		v3(
			km.Vector3Barycenter(
				{ x: 0.2, y: 0.3, z: 0 },
				{ x: 0, y: 0, z: 0 },
				{ x: 1, y: 0, z: 0 },
				{ x: 0, y: 1, z: 0 },
			),
		),
		3,
		'Barycenter',
	);

	const n = km.Vector3Normalize({ x: 0.2, y: 0.9, z: -0.3 });
	c.rm_Vector3Refract(0.5, -0.5, 0.7, n.x, n.y, n.z, 0.66, outPtr);
	expectSame(v3(km.Vector3Refract({ x: 0.5, y: -0.5, z: 0.7 }, n, 0.66)), 3, 'Refract');

	c.rm_Vector3ClampValue(3, 4, 5, 1, 2, outPtr);
	expectSame(v3(km.Vector3ClampValue({ x: 3, y: 4, z: 5 }, 1, 2)), 3, 'ClampValue');

	c.rm_Vector3MoveTowards(1, 2, 3, 9, -3, 4, 2.5, outPtr);
	expectSame(
		v3(km.Vector3MoveTowards({ x: 1, y: 2, z: 3 }, { x: 9, y: -3, z: 4 }, 2.5)),
		3,
		'MoveTowards',
	);
});

test('Vector3 rotation', () => {
	c.rm_Vector3RotateByAxisAngle(1, 0, 0, 0.3, 0.5, -0.8, 1.2, outPtr);
	expectSame(
		v3(km.Vector3RotateByAxisAngle({ x: 1, y: 0, z: 0 }, { x: 0.3, y: 0.5, z: -0.8 }, 1.2)),
		3,
		'RotateByAxisAngle',
	);

	const q = km.QuaternionFromEuler(0.3, -0.7, 1.1);
	c.rm_Vector3RotateByQuaternion(1, 2, 3, q.x, q.y, q.z, q.w, outPtr);
	expectSame(v3(km.Vector3RotateByQuaternion({ x: 1, y: 2, z: 3 }, q)), 3, 'RotateByQuaternion');
});

test('Vector3OrthoNormalize mutates both inputs', () => {
	c.rm_Vector3OrthoNormalize(3, 0, 0, 0, 2, 0, outPtr);

	const v1 = { x: 3, y: 0, z: 0 };
	const v2vec = { x: 0, y: 2, z: 0 };
	km.Vector3OrthoNormalize(v1, v2vec);

	expectSame([...v3(v1), ...v3(v2vec)], 6, 'OrthoNormalize');
});

test('Vector3CubicHermite', () => {
	c.rm_Vector3CubicHermite(0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0.35, outPtr);
	expectSame(
		v3(
			km.Vector3CubicHermite(
				{ x: 0, y: 0, z: 0 },
				{ x: 1, y: 0, z: 0 },
				{ x: 1, y: 1, z: 1 },
				{ x: 0, y: 1, z: 0 },
				0.35,
			),
		),
		3,
		'CubicHermite',
	);
});

test('Vector3 matrix interaction', () => {
	c.rm_Vector3Transform(1, -2, 3, ptr(SAMPLE), outPtr);
	expectSame(v3(km.Vector3Transform({ x: 1, y: -2, z: 3 }, SAMPLE)), 3, 'Transform');

	const projection = km.MatrixPerspective(0.9, 1.6, 0.1, 100);
	const view = km.MatrixLookAt({ x: 4, y: 3, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });

	c.rm_Vector3Unproject(0.2, -0.3, 0.5, ptr(projection), ptr(view), outPtr);
	expectSame(
		v3(km.Vector3Unproject({ x: 0.2, y: -0.3, z: 0.5 }, projection, view)),
		3,
		'Unproject',
	);
});

test('matrix construction', () => {
	c.rm_MatrixTranslate(1, -2, 3, outPtr);
	expectSame(km.MatrixTranslate(1, -2, 3), 16, 'Translate');

	c.rm_MatrixScale(2, 3, 4, outPtr);
	expectSame(km.MatrixScale(2, 3, 4), 16, 'Scale');

	c.rm_MatrixRotateX(0.7, outPtr);
	expectSame(km.MatrixRotateX(0.7), 16, 'RotateX');

	c.rm_MatrixRotateY(0.7, outPtr);
	expectSame(km.MatrixRotateY(0.7), 16, 'RotateY');

	c.rm_MatrixRotateZ(0.7, outPtr);
	expectSame(km.MatrixRotateZ(0.7), 16, 'RotateZ');

	c.rm_MatrixRotate(0.3, 0.5, -0.8, 1.2, outPtr);
	expectSame(km.MatrixRotate({ x: 0.3, y: 0.5, z: -0.8 }, 1.2), 16, 'Rotate');

	c.rm_MatrixRotateXYZ(0.3, -0.7, 1.1, outPtr);
	expectSame(km.MatrixRotateXYZ({ x: 0.3, y: -0.7, z: 1.1 }), 16, 'RotateXYZ');

	c.rm_MatrixRotateZYX(0.3, -0.7, 1.1, outPtr);
	expectSame(km.MatrixRotateZYX({ x: 0.3, y: -0.7, z: 1.1 }), 16, 'RotateZYX');
});

test('matrix projection', () => {
	c.rm_MatrixFrustum(-2, 2, -1.5, 1.5, 0.1, 100, outPtr);
	expectSame(km.MatrixFrustum(-2, 2, -1.5, 1.5, 0.1, 100), 16, 'Frustum');

	c.rm_MatrixPerspective(0.9, 1.6, 0.1, 100, outPtr);
	expectSame(km.MatrixPerspective(0.9, 1.6, 0.1, 100), 16, 'Perspective');

	c.rm_MatrixOrtho(-2, 2, -1.5, 1.5, 0.1, 100, outPtr);
	expectSame(km.MatrixOrtho(-2, 2, -1.5, 1.5, 0.1, 100), 16, 'Ortho');

	c.rm_MatrixLookAt(4, 3, 8, 0, 0, 0, 0, 1, 0, outPtr);
	expectSame(
		km.MatrixLookAt({ x: 4, y: 3, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
		16,
		'LookAt',
	);
});

test('matrix algebra', () => {
	expectClose(km.MatrixDeterminant(SAMPLE), c.rm_MatrixDeterminant(ptr(SAMPLE)), 'Determinant');
	expectClose(km.MatrixTrace(SAMPLE), c.rm_MatrixTrace(ptr(SAMPLE)), 'Trace');

	c.rm_MatrixTranspose(ptr(SAMPLE), outPtr);
	expectSame(km.MatrixTranspose(SAMPLE), 16, 'Transpose');

	c.rm_MatrixInvert(ptr(SAMPLE), outPtr);
	expectSame(km.MatrixInvert(SAMPLE), 16, 'Invert');

	const other = km.MatrixRotateY(0.4);
	c.rm_MatrixMultiply(ptr(SAMPLE), ptr(other), outPtr);
	expectSame(km.MatrixMultiply(SAMPLE, other), 16, 'Multiply');
});

test('matrix compose and decompose', () => {
	const rotation = km.QuaternionFromEuler(0.3, -0.7, 1.1);

	c.rm_MatrixCompose(1, -2, 3, rotation.x, rotation.y, rotation.z, rotation.w, 2, 3, 4, outPtr);
	const composed = km.MatrixCompose({ x: 1, y: -2, z: 3 }, rotation, { x: 2, y: 3, z: 4 });
	expectSame(composed, 16, 'Compose');

	c.rm_MatrixDecompose(ptr(SAMPLE), outPtr);
	const decomposed = km.MatrixDecompose(SAMPLE);
	expectSame(
		[...v3(decomposed.translation), ...v4(decomposed.rotation), ...v3(decomposed.scale)],
		10,
		'Decompose',
	);
});

test('quaternion algebra', () => {
	const a = km.QuaternionFromEuler(0.3, -0.7, 1.1);
	const b = km.QuaternionFromEuler(-1.2, 0.4, 0.25);

	c.rm_QuaternionMultiply(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, outPtr);
	expectSame(v4(km.QuaternionMultiply(a, b)), 4, 'Multiply');

	c.rm_QuaternionInvert(a.x, a.y, a.z, a.w, outPtr);
	expectSame(v4(km.QuaternionInvert(a)), 4, 'Invert');

	c.rm_QuaternionNlerp(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, 0.35, outPtr);
	expectSame(v4(km.QuaternionNlerp(a, b, 0.35)), 4, 'Nlerp');

	c.rm_QuaternionSlerp(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, 0.35, outPtr);
	expectSame(v4(km.QuaternionSlerp(a, b, 0.35)), 4, 'Slerp');

	c.rm_QuaternionTransform(a.x, a.y, a.z, a.w, ptr(SAMPLE), outPtr);
	expectSame(v4(km.QuaternionTransform(a, SAMPLE)), 4, 'Transform');
});

test('quaternion slerp takes the nlerp shortcut for close inputs', () => {
	const a = km.QuaternionFromEuler(0.3, -0.7, 1.1);
	const b = km.QuaternionFromEuler(0.31, -0.69, 1.11);

	c.rm_QuaternionSlerp(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, 0.4, outPtr);
	expectSame(v4(km.QuaternionSlerp(a, b, 0.4)), 4, 'Slerp close');
});

test('quaternion conversions', () => {
	const q = km.QuaternionFromEuler(0.3, -0.7, 1.1);

	c.rm_QuaternionFromEuler(0.3, -0.7, 1.1, outPtr);
	expectSame(v4(q), 4, 'FromEuler');

	c.rm_QuaternionToEuler(q.x, q.y, q.z, q.w, outPtr);
	expectSame(v3(km.QuaternionToEuler(q)), 3, 'ToEuler');

	c.rm_QuaternionFromAxisAngle(0.3, 0.5, -0.8, 1.2, outPtr);
	expectSame(v4(km.QuaternionFromAxisAngle({ x: 0.3, y: 0.5, z: -0.8 }, 1.2)), 4, 'FromAxisAngle');

	c.rm_QuaternionToAxisAngle(q.x, q.y, q.z, q.w, outPtr);
	const axisAngle = km.QuaternionToAxisAngle(q);
	expectSame([...v3(axisAngle.axis), axisAngle.angle], 4, 'ToAxisAngle');

	c.rm_QuaternionToMatrix(q.x, q.y, q.z, q.w, outPtr);
	expectSame(km.QuaternionToMatrix(q), 16, 'ToMatrix');

	const rotationOnly = km.MatrixRotateXYZ({ x: 0.3, y: -0.7, z: 1.1 });
	c.rm_QuaternionFromMatrix(ptr(rotationOnly), outPtr);
	expectSame(v4(km.QuaternionFromMatrix(rotationOnly)), 4, 'FromMatrix');

	c.rm_QuaternionFromVector3ToVector3(1, 0, 0, 0, 1, 0, outPtr);
	expectSame(
		v4(km.QuaternionFromVector3ToVector3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })),
		4,
		'FromVector3ToVector3',
	);
});

test('QuaternionCubicHermiteSpline', () => {
	const a = km.QuaternionFromEuler(0.3, -0.7, 1.1);
	const b = km.QuaternionFromEuler(-1.2, 0.4, 0.25);
	const t1 = km.QuaternionFromEuler(0.1, 0.1, 0.1);
	const t2 = km.QuaternionFromEuler(-0.1, 0.2, -0.05);

	c.rm_QuaternionCubicHermiteSpline(
		a.x,
		a.y,
		a.z,
		a.w,
		t1.x,
		t1.y,
		t1.z,
		t1.w,
		b.x,
		b.y,
		b.z,
		b.w,
		t2.x,
		t2.y,
		t2.z,
		t2.w,
		0.35,
		outPtr,
	);
	expectSame(v4(km.QuaternionCubicHermiteSpline(a, t1, b, t2, 0.35)), 4, 'CubicHermiteSpline');
});
