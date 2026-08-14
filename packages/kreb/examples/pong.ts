// Manual check: bun packages/kreb/examples/pong.ts
//
// A complete small game: input, collision layers, callbacks, UI, and a state
// machine, without a single asset file.

import { buildShim } from '@kreb/raylib-sys/build';
import { SHIM_SOURCE } from '@kreb/raylib-sys/shim-path';
import type { Collider, Draw2D, DrawUI } from 'kreb';

await buildShim([SHIM_SOURCE], 'kreb_raylib');

const { Anchor, BoxCollider2D, Ease, Key, NodeUI, Scene, actions, axis2, fsm, game, input, layer } =
	await import('kreb');

const WIDTH = 900;
const HEIGHT = 560;
const PADDLE = { width: 16, height: 110 };
const BALL = 14;

const Layer = {
	Paddle: layer(0),
	Ball: layer(1),
	Wall: layer(2),
};

const Act = actions({
	left: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
	right: axis2({
		up: Key.KEY_UP,
		down: Key.KEY_DOWN,
		left: Key.KEY_LEFT,
		right: Key.KEY_RIGHT,
	}),
	serve: Key.KEY_SPACE,
});

const score = { left: 0, right: 0 };

class Paddle extends BoxCollider2D {
	constructor(
		private readonly axis: typeof Act.left,
		name: string,
	) {
		super({ x: PADDLE.width, y: PADDLE.height }, { layer: Layer.Paddle }, name);
	}

	override update(dt: number): void {
		const half = PADDLE.height / 2;

		this.position.y += input.axis(this.axis).y * 460 * dt;
		this.position.y = Math.min(Math.max(this.position.y, half), HEIGHT - half);
	}

	override draw(g: Draw2D): void {
		g.rect(-PADDLE.width / 2, -PADDLE.height / 2, PADDLE.width, PADDLE.height, {
			color: 0xf5f5f5ff,
		});
	}
}

class Ball extends BoxCollider2D {
	readonly velocity = { x: 0, y: 0 };

	readonly phase = fsm({
		waiting: { serve: 'flying' },
		flying: { score: 'waiting' },
	});

	constructor(name: string) {
		super({ x: BALL, y: BALL }, { layer: Layer.Ball, mask: Layer.Paddle }, name);
		this.reset();
	}

	reset(): void {
		this.position.set({ x: WIDTH / 2, y: HEIGHT / 2 });
		this.velocity.x = 0;
		this.velocity.y = 0;
	}

	serve(): void {
		if (!this.phase.send('serve')) return;

		const towardLeft = Math.random() < 0.5;
		this.velocity.x = towardLeft ? -360 : 360;
		this.velocity.y = (Math.random() * 2 - 1) * 220;
	}

	// A paddle hit reverses the ball and adds spin from where it struck.
	override onEnter(other: Collider): void {
		if (other.layer !== Layer.Paddle) return;

		const paddle = other as Paddle;
		const offset = (this.position.y - paddle.position.y) / (PADDLE.height / 2);

		this.velocity.x = -this.velocity.x * 1.04;
		this.velocity.y += offset * 200;
		this.position.x += Math.sign(this.velocity.x) * 4;
	}

	override update(dt: number): void {
		if (this.phase.is('waiting')) {
			if (input.pressed(Act.serve)) this.serve();
			return;
		}

		this.position.x += this.velocity.x * dt;
		this.position.y += this.velocity.y * dt;

		const half = BALL / 2;
		if (this.position.y < half || this.position.y > HEIGHT - half) {
			this.velocity.y = -this.velocity.y;
			this.position.y = Math.min(Math.max(this.position.y, half), HEIGHT - half);
		}

		if (this.position.x < 0 || this.position.x > WIDTH) {
			if (this.position.x < 0) score.right += 1;
			else score.left += 1;

			this.phase.send('score');
			this.reset();
		}
	}

	override draw(g: Draw2D): void {
		g.rect(-BALL / 2, -BALL / 2, BALL, BALL, { color: 0xffd23fff });
	}
}

class Scoreboard extends NodeUI {
	flash = 0;

	#lastTotal = 0;

	override update(): void {
		const total = score.left + score.right;
		if (total === this.#lastTotal) return;

		this.#lastTotal = total;

		const scene = this.parent;
		if (scene instanceof Scene) {
			scene.tweens.run(0.5, Ease.OutCubic, (t) => {
				this.flash = 1 - t;
			});
		}
	}

	override draw(g: DrawUI): void {
		const text = `${score.left} — ${score.right}`;
		const width = g.measure(text, 48);

		g.rect(0, 0, 240 * this.flash, 4, { color: 0xffd23fff });
		g.text(text, (240 - width) / 2, 12, { size: 48, color: 0xf5f5f5ff });
	}
}

class Hint extends NodeUI {
	constructor(
		private readonly ball: Ball,
		name: string,
	) {
		super(name);
	}

	override draw(g: DrawUI): void {
		if (!this.ball.phase.is('waiting')) return;

		g.text('space to serve · W/S and arrows to move', 0, 0, {
			size: 18,
			color: 0x9aa0aaff,
		});
	}
}

class Court extends Scene {
	override ready(): void {
		const left = this.add(new Paddle(Act.left, 'left'));
		left.position.set({ x: 40, y: HEIGHT / 2 });

		const right = this.add(new Paddle(Act.right, 'right'));
		right.position.set({ x: WIDTH - 40, y: HEIGHT / 2 });

		const ball = this.add(new Ball('ball'));

		const board = this.add(new Scoreboard('score'));
		board.anchor = Anchor.TopCenter;
		board.offset = { x: -120, y: 16, width: 240, height: 70 };

		const hint = this.add(new Hint(ball, 'hint'));
		hint.anchor = Anchor.BottomCenter;
		hint.offset = { x: -180, y: -40, width: 360, height: 24 };
	}
}

game({
	window: { width: WIDTH, height: HEIGHT, title: 'kreb pong', targetFps: 60 },
	scenes: { court: Court },
	start: 'court',
	clearColor: 0x14171cff,
}).run();
