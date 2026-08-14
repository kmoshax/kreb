import { afterAll, beforeAll, expect, test } from 'bun:test';
import { buildShim } from '@kreb/raylib-sys/build';
import type { Draw2D, Draw3D, DrawUI } from '../src/index.ts';

type Kreb = typeof import('../src/index.ts');
type Sys = typeof import('@kreb/raylib-sys');
type Colors = typeof import('@kreb/raylib-sys/colors');

let k: Kreb;
let sys: Sys;
let colors: Colors;

const WIDTH = 320;
const HEIGHT = 240;

const drawn: string[] = [];

beforeAll(async () => {
	const source = new URL('../../raylib-sys/native/kreb_shim.c', import.meta.url).pathname;
	await buildShim([source], 'kreb_raylib');

	k = await import('../src/index.ts');
	sys = await import('@kreb/raylib-sys');
	colors = await import('@kreb/raylib-sys/colors');
});

function makeGame() {
	class Spinner extends k.Node3D {
		model = k.Model.fromMesh(sys.Mesh.cube(1, 1, 1));

		override update(dt: number): void {
			this.position.x += dt;
		}

		override draw(g: Draw3D): void {
			drawn.push('3d');
			g.model(this.model);
		}
	}

	class Sprite extends k.Node2D {
		texture = k.Texture.fromImage(sys.Image.color(8, 8, colors.RED));

		override draw(g: Draw2D): void {
			drawn.push('2d');
			g.sprite(this.texture, { x: 0, y: 0 });
			g.circle({ x: 4, y: 4 }, 3, { color: colors.MAROON });
		}
	}

	class Hud extends k.NodeUI {
		override draw(g: DrawUI): void {
			drawn.push('ui');
			g.rect(0, 0, 120, 24, { color: colors.DARKBLUE });
			g.text('score 0', 4, 4, { size: 10, color: colors.RAYWHITE });
		}
	}

	class Level extends k.Scene {
		override ready(): void {
			this.camera3d = this.add(new k.Camera3D('eye'));
			this.camera3d.position.set({ x: 4, y: 4, z: 8 });

			this.camera2d = this.add(new k.Camera2D('flat'));

			this.add(new Spinner('spinner'));
			this.add(new Sprite('sprite'));

			const hud = this.add(new Hud('hud'));
			hud.anchor = k.Anchor.TopLeft;
			hud.offset = { x: 8, y: 8, width: 120, height: 24 };
		}
	}

	return k.game({
		window: { width: WIDTH, height: HEIGHT, title: 'kreb phase 6', hidden: true },
		scenes: { level: Level },
		start: 'level',
	});
}

let game: ReturnType<typeof makeGame>;

beforeAll(() => {
	game = makeGame();
	game.open();
});

afterAll(() => {
	game.close();
});

test('the start scene is active after open', () => {
	expect(game.scenes.depth).toBe(1);
	expect(game.scenes.active.name).toBe('Level');
});

test('a frame runs all three passes', () => {
	drawn.length = 0;
	game.render();

	expect(drawn).toEqual(['3d', '2d', 'ui']);
});

test('fixed updates advance node state', () => {
	const spinner = game.scenes.active.children.find((n) => n.name === 'spinner');
	if (!(spinner instanceof k.Node3D)) throw new Error('spinner missing');

	const before = spinner.position.x;
	game.update(1 / 60);
	game.update(1 / 60);

	expect(spinner.position.x).toBeCloseTo(before + 2 / 60, 5);
});

test('a moved node reports a new world transform to the renderer', () => {
	const spinner = game.scenes.active.children.find((n) => n.name === 'spinner');
	if (!(spinner instanceof k.Node3D)) throw new Error('spinner missing');

	spinner.position.set({ x: 42, y: 0, z: 0 });
	expect(spinner.globalPosition.x).toBeCloseTo(42, 5);
});

test('many frames run without error', () => {
	for (let i = 0; i < 30; i += 1) {
		game.update(1 / 60);
		game.render();
	}

	expect(game.scenes.depth).toBe(1);
});

test('pushing a scene overlays it and popping restores the one below', () => {
	class Pause extends k.Scene {}

	game.scenes.push(new Pause('pause'));
	expect(game.scenes.depth).toBe(2);
	expect(game.scenes.active.name).toBe('pause');

	game.render();

	game.scenes.pop();
	expect(game.scenes.depth).toBe(1);
	expect(game.scenes.active.name).toBe('Level');
});

test('an unknown start scene names the ones that exist', () => {
	class Empty extends k.Scene {}

	const broken = k.game({
		window: { width: 64, height: 64, title: 'kreb bad start', hidden: true },
		scenes: { menu: Empty },
		start: 'missing' as 'menu',
	});

	expect(() => broken.open()).toThrow('Unknown start scene "missing"');
	expect(() => broken.open()).toThrow('menu');

	broken.close();
});
