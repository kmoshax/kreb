// Manual check: bun packages/kreb/examples/pong.ts

import {
	Anchor,
	actions,
	axis2,
	BoxCollider2D,
	Clamp,
	type Collider,
	type DrawUI,
	Ease,
	fsm,
	GOLD,
	game,
	hex,
	input,
	Key,
	Label,
	layer,
	NodeUI,
	RAYWHITE,
	Scene,
} from 'kreb';

const W = 900;
const H = 560;

const Layer = { Paddle: layer(0), Ball: layer(1) };

const Act = actions({
	left: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
	right: axis2({ up: Key.KEY_UP, down: Key.KEY_DOWN, left: Key.KEY_LEFT, right: Key.KEY_RIGHT }),
	serve: Key.KEY_SPACE,
});

const score = { left: 0, right: 0 };

class Paddle extends BoxCollider2D {
	speed = 460;

	constructor(
		private readonly axis: typeof Act.left,
		x: number,
	) {
		super({ size: [16, 110], color: RAYWHITE, layer: Layer.Paddle, at: [x, H / 2] });
	}

	override update(dt: number): void {
		const limit = this.extents.y;

		this.y = Clamp(this.y + input.axis(this.axis).y * this.speed * dt, limit, H - limit);
	}
}

class Ball extends BoxCollider2D {
	readonly velocity = { x: 0, y: 0 };

	readonly phase = fsm({
		waiting: { serve: 'flying' },
		flying: { score: 'waiting' },
	});

	constructor() {
		super({ size: [14, 14], color: GOLD, layer: Layer.Ball, mask: Layer.Paddle });
		this.rest();
	}

	rest(): void {
		this.at(W / 2, H / 2);
		this.velocity.x = 0;
		this.velocity.y = 0;
	}

	serve(): void {
		this.velocity.x = Math.random() < 0.5 ? -360 : 360;
		this.velocity.y = (Math.random() * 2 - 1) * 220;
	}

	// Bounce off the paddle, taking spin from how far off centre it struck.
	override onEnter(other: Collider): void {
		if (!(other instanceof Paddle)) return;

		this.velocity.x *= -1.04;
		this.velocity.y += ((this.y - other.y) / other.extents.y) * 200;
		this.x += Math.sign(this.velocity.x) * 4;
	}

	override update(dt: number): void {
		if (this.phase.is('waiting')) {
			if (input.pressed(Act.serve) && this.phase.send('serve')) this.serve();
			return;
		}

		this.x += this.velocity.x * dt;
		this.y += this.velocity.y * dt;

		const limit = this.extents.y;
		if (this.y < limit || this.y > H - limit) {
			this.velocity.y *= -1;
			this.y = Clamp(this.y, limit, H - limit);
		}

		if (this.x < 0 || this.x > W) {
			if (this.x < 0) score.right += 1;
			else score.left += 1;

			this.phase.send('score');
			this.rest();
		}
	}
}

class Scoreboard extends NodeUI {
	flash = 0;

	#shown = -1;

	override update(): void {
		const total = score.left + score.right;
		if (total === this.#shown) return;

		this.#shown = total;
		this.scene.tweens.run(0.5, Ease.OutCubic, (t) => {
			this.flash = 1 - t;
		});
	}

	override draw(g: DrawUI): void {
		const text = `${score.left} \u2014 ${score.right}`;

		g.rect(0, 0, g.width * this.flash, 4, { color: GOLD });
		g.text(text, (g.width - g.measure(text, 48)) / 2, 12, { size: 48, color: RAYWHITE });
	}
}

class Court extends Scene {
	readonly ball = new Ball();
	readonly hint = new Label('space to serve, W/S and arrows to move', 'hint');

	override ready(): void {
		this.add(new Paddle(Act.left, 40));
		this.add(new Paddle(Act.right, W - 40));
		this.add(this.ball);

		this.add(new Scoreboard('score')).place({
			anchor: Anchor.TopCenter,
			x: -120,
			y: 16,
			width: 240,
			height: 70,
		});

		this.hint.muted = true;
		this.add(this.hint).place({ anchor: Anchor.BottomCenter, x: -180, y: -40 });
	}

	override update(): void {
		this.hint.visible = this.ball.phase.is('waiting');
	}
}

game({
	window: { width: W, height: H, title: 'kreb pong', targetFps: 60 },
	scenes: { court: Court },
	start: 'court',
	clearColor: hex(0x14171c),
}).run();
