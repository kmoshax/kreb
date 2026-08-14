// Manual check: bun packages/kreb/examples/demo.ts

import { buildShim } from '@kreb/raylib-sys/build';
import type { Draw2D, Draw3D, DrawUI } from '../src/index.ts';

await buildShim(
	[new URL('../../raylib-sys/native/kreb_shim.c', import.meta.url).pathname],
	'kreb_raylib',
);

const {
	actions,
	axis2,
	input,
	Key,
	Anchor,
	Camera2D,
	Camera3D,
	game,
	Image,
	Mesh,
	Model,
	Node2D,
	Node3D,
	NodeUI,
	Scene,
	Texture,
} = await import('../src/index.ts');

const { DARKBLUE, GOLD, MAROON, RAYWHITE, SKYBLUE, WHITE } = await import(
	'@kreb/raylib-sys/colors'
);

const Act = actions({
	move: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
	boost: Key.KEY_LEFT_SHIFT,
	jump: Key.KEY_SPACE,
});

const WIDTH = 960;
const HEIGHT = 540;

class Cube extends Node3D {
	readonly model = Model.fromMesh(Mesh.cube(1.4, 1.4, 1.4));

	#spin = 0;

	constructor(
		name: string,
		private readonly orbit: number,
		private readonly speed: number,
	) {
		super(name);
	}

	override update(dt: number): void {
		this.#spin += this.speed * dt;

		this.position.set({
			x: Math.cos(this.#spin) * this.orbit,
			y: 0,
			z: Math.sin(this.#spin) * this.orbit,
		});

		const half = this.#spin * 0.5;
		this.rotation.set({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
	}

	override draw(g: Draw3D): void {
		g.model(this.model, { tint: GOLD });
	}
}

class Ground extends Node3D {
	override draw(g: Draw3D): void {
		for (let i = -5; i <= 5; i += 1) {
			g.line({ x: i, y: 0, z: -5 }, { x: i, y: 0, z: 5 }, { color: DARKBLUE });
			g.line({ x: -5, y: 0, z: i }, { x: 5, y: 0, z: i }, { color: DARKBLUE });
		}
	}
}

class Player extends Node2D {
	readonly texture = Texture.fromImage(Image.color(48, 48, MAROON));

	readonly #velocity = { x: 220, y: 160 };

	#driven = false;

	override update(dt: number): void {
		const direction = input.axis(Act.move);

		if (direction.x !== 0 || direction.y !== 0) {
			this.#driven = true;
			const speed = input.held(Act.boost) ? 720 : 320;
			this.position.x += direction.x * speed * dt;
			this.position.y += direction.y * speed * dt;
		} else if (!this.#driven) {
			this.position.x += this.#velocity.x * dt;
			this.position.y += this.#velocity.y * dt;

			if (this.position.x < 0 || this.position.x > WIDTH - 48) this.#velocity.x *= -1;
			if (this.position.y < 0 || this.position.y > HEIGHT - 48) this.#velocity.y *= -1;
		}

		this.rotation += dt;
	}

	override draw(g: Draw2D): void {
		g.sprite(this.texture, { x: 0, y: 0 }, { origin: { x: 24, y: 24 } });
	}
}

// A child of Player, so it inherits the bounce for free.
class Trail extends Node2D {
	override draw(g: Draw2D): void {
		g.circle({ x: 0, y: 0 }, 8, { color: SKYBLUE });
	}
}

class Hud extends NodeUI {
	frames = 0;
	jumps = 0;

	override update(): void {
		this.frames += 1;
		if (input.pressed(Act.jump)) this.jumps += 1;
	}

	override draw(g: DrawUI): void {
		g.rect(0, 0, 240, 58, { color: DARKBLUE });
		g.text('WASD · shift · space', 10, 8, { size: 20, color: RAYWHITE });
		g.text(`${this.frames} steps · ${this.jumps} jumps`, 10, 32, { size: 16, color: WHITE });
	}
}

class Level extends Scene {
	override ready(): void {
		const eye = this.add(new Camera3D('eye'));
		eye.position.set({ x: 8, y: 7, z: 8 });
		eye.target = { x: 0, y: 0, z: 0 };
		this.camera3d = eye;

		this.camera2d = this.add(new Camera2D('flat'));

		this.add(new Ground('ground'));
		this.add(new Cube('gold', 3, 1.1));
		this.add(new Cube('inner', 1.4, -1.9));

		const player = this.add(new Player('player'));
		player.position.set({ x: WIDTH / 2, y: HEIGHT / 2 });
		player.add(new Trail('trail')).position.set({ x: -40, y: 0 });

		const hud = this.add(new Hud('hud'));
		hud.anchor = Anchor.TopLeft;
		hud.offset = { x: 12, y: 12, width: 240, height: 58 };
	}
}

game({
	window: { width: WIDTH, height: HEIGHT, title: 'kreb', targetFps: 60 },
	scenes: { level: Level },
	start: 'level',
}).run();
