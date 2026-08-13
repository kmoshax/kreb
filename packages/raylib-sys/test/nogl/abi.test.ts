import { CString, dlopen, type FFIFunction, ptr } from 'bun:ffi';
import { beforeAll, expect, test } from 'bun:test';
import { buildShim } from '../../scripts/build-shim.ts';
import { RAYLIB_VERSION } from '../../src/raylib-path.ts';

const probeSource = new URL('../../native/abi_probe.c', import.meta.url).pathname;

const symbols = {
	probe_ret4_GetColor: { args: ['u32'], returns: 'u32' },
	probe_arg4_ColorToInt: { args: ['u32'], returns: 'i32' },
	probe_arg4_ret4_Fade: { args: ['u32', 'f32'], returns: 'u32' },
	probe_ret12_ColorToHSV: { args: ['u32', 'ptr'], returns: 'void' },
	probe_ret4_ColorFromHSV: { args: ['f32', 'f32', 'f32'], returns: 'u32' },
	probe_arg16x2_CheckCollisionRecs: {
		args: ['f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32'],
		returns: 'i32',
	},
	probe_arg16x2_ret16_GetCollisionRec: {
		args: ['f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'ptr'],
		returns: 'void',
	},
	probe_arg8_arg16_CheckCollisionPointRec: {
		args: ['f32', 'f32', 'f32', 'f32', 'f32', 'f32'],
		returns: 'i32',
	},
	probe_arg8_mem24_GetWorldToScreen2D: {
		args: ['f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'ptr'],
		returns: 'void',
	},
	probe_mem44_sret64_GetCameraMatrix: {
		args: ['f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'f32', 'i32', 'ptr'],
		returns: 'void',
	},
	probe_raylib_version: { args: [], returns: 'ptr' },
} satisfies Record<string, FFIFunction>;

let raylib: ReturnType<typeof dlopen<typeof symbols>>['symbols'];

beforeAll(async () => {
	const { libPath } = await buildShim([probeSource], 'kreb_probe');
	raylib = dlopen(libPath, symbols).symbols;
});

const floats = (length: number) => new Float32Array(length);
const unsigned = (n: number) => n >>> 0;

const RED = 0xff0000ff;
const SLATE = 0x336699ff;
const RED_HALF_ALPHA = 0xff00007f;

test('linked raylib matches the pinned version', () => {
	const version = raylib.probe_raylib_version();
	if (version === null) throw new Error('probe_raylib_version returned a null pointer');

	expect(new CString(version).toString()).toBe(RAYLIB_VERSION);
});

test('4-byte struct returned by value', () => {
	expect(unsigned(raylib.probe_ret4_GetColor(SLATE))).toBe(SLATE);
});

test('4-byte struct passed by value', () => {
	expect(unsigned(raylib.probe_arg4_ColorToInt(SLATE))).toBe(SLATE);
});

test('4-byte struct in and out alongside a float, alpha truncating toward zero', () => {
	expect(unsigned(raylib.probe_arg4_ret4_Fade(RED, 0.5))).toBe(RED_HALF_ALPHA);
});

test('12-byte struct returned by value, hue in degrees', () => {
	const hsv = floats(3);
	raylib.probe_ret12_ColorToHSV(RED, ptr(hsv));

	expect(hsv[0]).toBeCloseTo(0, 5);
	expect(hsv[1]).toBeCloseTo(1, 5);
	expect(hsv[2]).toBeCloseTo(1, 5);
});

test('scalars in, 4-byte struct out', () => {
	expect(unsigned(raylib.probe_ret4_ColorFromHSV(0, 1, 1))).toBe(RED);
});

test('two 16-byte SSE structs passed by value', () => {
	expect(raylib.probe_arg16x2_CheckCollisionRecs(0, 0, 10, 10, 5, 5, 10, 10)).toBe(1);
	expect(raylib.probe_arg16x2_CheckCollisionRecs(0, 0, 10, 10, 20, 20, 5, 5)).toBe(0);
});

test('two 16-byte structs in, one 16-byte struct out', () => {
	const overlap = floats(4);
	raylib.probe_arg16x2_ret16_GetCollisionRec(0, 0, 10, 10, 5, 5, 10, 10, ptr(overlap));

	expect(Array.from(overlap)).toEqual([5, 5, 5, 5]);
});

test('mixed 8-byte and 16-byte SSE structs', () => {
	expect(raylib.probe_arg8_arg16_CheckCollisionPointRec(5, 5, 0, 0, 10, 10)).toBe(1);
	expect(raylib.probe_arg8_arg16_CheckCollisionPointRec(50, 5, 0, 0, 10, 10)).toBe(0);
});

test('24-byte MEMORY struct passed on the stack, identity camera', () => {
	const screen = floats(2);
	raylib.probe_arg8_mem24_GetWorldToScreen2D(10, 20, 0, 0, 0, 0, 0, 1, ptr(screen));

	expect(Array.from(screen)).toEqual([10, 20]);
});

test('24-byte MEMORY struct passed on the stack, zoomed and offset camera', () => {
	const screen = floats(2);
	raylib.probe_arg8_mem24_GetWorldToScreen2D(10, 20, 100, 50, 0, 0, 0, 2, ptr(screen));

	expect(Array.from(screen)).toEqual([120, 90]);
});

test('44-byte MEMORY struct in, 64-byte struct out via hidden sret', () => {
	const view = floats(16);
	raylib.probe_mem44_sret64_GetCameraMatrix(0, 0, 10, 0, 0, 0, 0, 1, 0, 45, 0, ptr(view));

	const eyeTranslationZ = view[14];
	expect(view[0]).toBeCloseTo(1, 5);
	expect(view[5]).toBeCloseTo(1, 5);
	expect(view[10]).toBeCloseTo(1, 5);
	expect(view[12]).toBeCloseTo(0, 5);
	expect(view[13]).toBeCloseTo(0, 5);
	expect(eyeTranslationZ).toBeCloseTo(-10, 5);
	expect(view[15]).toBeCloseTo(1, 5);
});
