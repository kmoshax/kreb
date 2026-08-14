import { afterAll, beforeAll, expect, test } from 'bun:test';
import { buildShim } from '../../scripts/build-shim.ts';

const FLAG_WINDOW_HIDDEN = 0x00000080;
const LOG_WARNING = 4;

type Handles = typeof import('../../src/handles.ts');
type Bindings = typeof import('../../src/generated/raylib.ts');
type Colors = typeof import('../../src/generated/colors.ts');

let h: Handles;
let rl: Bindings;
let colors: Colors;

beforeAll(async () => {
	const source = new URL('../../native/kreb_shim.c', import.meta.url).pathname;
	await buildShim([source], 'kreb_raylib');

	rl = await import('../../src/generated/raylib.ts');
	colors = await import('../../src/generated/colors.ts');
	h = await import('../../src/handles.ts');

	rl.SetTraceLogLevel(LOG_WARNING);
	rl.SetConfigFlags(FLAG_WINDOW_HIDDEN);
	rl.InitWindow(320, 240, 'kreb handles');
});

afterAll(() => {
	rl.CloseWindow();
});

test('an image exposes its dimensions and disposes', () => {
	const image = h.Image.color(8, 4, colors.RED);

	expect(image.width).toBe(8);
	expect(image.height).toBe(4);
	expect(image.disposed).toBe(false);

	image.dispose();
	expect(image.disposed).toBe(true);
});

test('a texture uploads from an image and reports a live id', () => {
	using image = h.Image.color(16, 16, colors.BLUE);
	using texture = h.Texture.fromImage(image);

	expect(texture.id).toBeGreaterThan(0);
	expect(texture.width).toBe(16);
	expect(texture.height).toBe(16);
});

test('use after dispose throws and names the resource', () => {
	const image = h.Image.color(4, 4, colors.GREEN);
	image.dispose();

	expect(() => image.width).toThrow('was used after dispose()');
	expect(() => image.width).toThrow('Image(4x4)');
});

test('dispose is idempotent', () => {
	const image = h.Image.color(4, 4, colors.GREEN);

	image.dispose();
	expect(() => image.dispose()).not.toThrow();
	expect(image.disposed).toBe(true);
});

test('a failed load throws instead of yielding a dead handle', () => {
	expect(() => h.Texture.load('does-not-exist.png')).toThrow('Failed to load');
	expect(() => h.Texture.load('does-not-exist.png')).toThrow('does-not-exist.png');
});

test('using declarations dispose at scope exit', () => {
	let captured: ReturnType<Handles['Image']['color']>;

	{
		using image = h.Image.color(2, 2, colors.RED);
		captured = image;
		expect(image.disposed).toBe(false);
	}

	expect(captured.disposed).toBe(true);
});

test('a render texture is usable as a draw target', () => {
	using target = h.RenderTexture.create(64, 64);

	expect(target.id).toBeGreaterThan(0);

	rl.BeginTextureMode(target.pointer);
	rl.ClearBackground(colors.RAYWHITE);
	rl.DrawCircleV(32, 32, 10, colors.MAROON);
	rl.EndTextureMode();
});

test('a mesh becomes a model that draws', () => {
	const mesh = h.Mesh.cube(1, 1, 1);
	expect(mesh.vertexCount).toBeGreaterThan(0);

	using model = h.Model.fromMesh(mesh);
	expect(model.meshCount).toBe(1);

	expect(mesh.disposed).toBe(true);

	rl.BeginDrawing();
	rl.ClearBackground(colors.RAYWHITE);
	rl.DrawModel(model.pointer, 0, 0, 0, 1, colors.WHITE);
	rl.EndDrawing();
});

test('a failed audio load throws rather than yielding a silent handle', () => {
	expect(() => h.Sound.load('missing.wav')).toThrow('Failed to load');
	expect(() => h.Music.load('missing.ogg')).toThrow('Failed to load');
});
