// The generated module calls loadShim at import time, so the shim is built
// first and the module imported dynamically.

import { afterAll, beforeAll, expect, test } from 'bun:test';
import { buildShim } from '@kreb/raylib-sys/build';
import { SHIM_SOURCE } from '@kreb/raylib-sys/shim-path';

const WIDTH = 320;
const HEIGHT = 240;

const FLAG_WINDOW_HIDDEN = 0x00000080;
const LOG_WARNING = 4;

type Bindings = typeof import('@kreb/raylib-sys/raylib');
type Colors = typeof import('@kreb/raylib-sys/colors');

let rl: Bindings;
let colors: Colors;

beforeAll(async () => {
	await buildShim([SHIM_SOURCE], 'kreb_raylib');

	rl = await import('@kreb/raylib-sys/raylib');
	colors = await import('@kreb/raylib-sys/colors');

	rl.SetTraceLogLevel(LOG_WARNING);
	rl.SetConfigFlags(FLAG_WINDOW_HIDDEN);
	rl.InitWindow(WIDTH, HEIGHT, 'kreb generated');
});

afterAll(() => {
	rl.CloseWindow();
});

test('the window reports the requested size', () => {
	expect(rl.IsWindowReady()).toBe(true);
	expect(rl.GetScreenWidth()).toBe(WIDTH);
	expect(rl.GetScreenHeight()).toBe(HEIGHT);
});

test('a frame draws through generated bindings', () => {
	rl.BeginDrawing();
	rl.ClearBackground(colors.RAYWHITE);
	rl.DrawText('kreb', 16, 16, 20, colors.LIGHTGRAY);
	rl.DrawCircleV(160, 120, 40, colors.MAROON);
	rl.DrawRectangleRec(10, 200, 60, 20, colors.DARKBLUE);
	rl.EndDrawing();

	expect(rl.GetFrameTime()).toBeGreaterThan(0);
});

test('bool returns surface as booleans', () => {
	expect(rl.IsKeyDown(256)).toBe(false);
	expect(rl.IsWindowFullscreen()).toBe(false);
});

test('struct returns come back as float arrays', () => {
	const mouse = rl.GetMousePosition();

	expect(mouse).toBeInstanceOf(Float32Array);
	expect(mouse.length).toBe(2);
	expect(Number.isFinite(mouse[0] as number)).toBe(true);
});

test('string returns decode', () => {
	expect(rl.GetWorkingDirectory().length).toBeGreaterThan(0);
});

test('a heap handle round-trips through alloc, use, and free', () => {
	const camera = rl.symbols.kreb_alloc_Camera2D();
	expect(camera).not.toBeNull();
	if (camera === null) throw new Error('allocation failed');

	const screen = rl.GetWorldToScreen2D(10, 20, camera);

	expect(screen).toBeInstanceOf(Float32Array);
	expect(screen.length).toBe(2);

	rl.free(camera);
});

test('a texture loads from an image and disposes', () => {
	const image = rl.GenImageColor(8, 8, colors.RED);
	expect(image).not.toBeNull();
	if (image === null) throw new Error('GenImageColor returned null');

	const texture = rl.LoadTextureFromImage(image);
	if (texture === null) throw new Error('LoadTextureFromImage returned null');

	rl.UnloadTexture(texture);
	rl.UnloadImage(image);
	rl.free(texture);
	rl.free(image);
});
