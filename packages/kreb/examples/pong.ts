// Manual check: bun packages/kreb/examples/pong.ts

import {
	Anchor,
	actions,
	axis2,
	BoxCollider2D,
	type Collider,
	type DrawUI,
	Ease,
	fsm,
	GOLD,
	GRAY,
	game,
	hex,
	input,
	Key,
	layer,
	measureText,
	NodeUI,
	RAYWHITE,
	Scene,
} from 'kreb';

const W = 900;
const H = 560;
const PADDLE = [16, 110] as const;
const BALL = 14;

const Layer = { Paddle: layer(0), Ball: layer(1) };

const Act = actions({
	left: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
	right: axis2({ up: Key.KEY_UP, down: Key.KEY_DOWN, left: Key.KEY_LEFT, right: Key.KEY_RIGHT }),
	serve: Key.KEY_SPACE,
});

const score = { left: 0, right: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

class Paddle extends BoxCollider2D {
	constructor(
		private readonly axis: typeof Act.left,
		x: number,
	) {
		super({ size: PADDLE, color: RAYWHITE, layer: Layer.Paddle, at: [x, H / 2] });
	}

	override update(dt: number): void {
		this.y = clamp(this.y + input.axis(this.axis).y * 460 * dt, PADDLE[1] / 2, H - PADDLE[1] / 2);
	}
}

class Ball extends BoxCollider2D {
	readonly velocity = { x: 0, y: 0 };

	readonly phase = fsm({
		waiting: { serve: 'flying' },
		flying: { score: 'waiting' },
	});

	constructor() {
		super({ size: [BALL, BALL], color: GOLD, layer: Layer.Ball, mask: Layer.Paddle });
		this.reset();
	}

	reset(): void {
		this.at(W / 2, H / 2);
		this.velocity.x = 0;
		this.velocity.y = 0;
	}

	// A paddle hit reverses the ball and adds spin from where it struck.
	override onEnter(other: Collider): void {
		if (other.layer !== Layer.Paddle) return;

		this.velocity.x *= -1.04;
		this.velocity.y += ((this.y - (other as Paddle).y) / (PADDLE[1] / 2)) * 200;
		this.x += Math.sign(this.velocity.x) * 4;
	}

	override update(dt: number): void {
		if (this.phase.is('waiting')) {
			if (input.pressed(Act.serve) && this.phase.send('serve')) {
				this.velocity.x = Math.random() < 0.5 ? -360 : 360;
				this.velocity.y = (Math.random() * 2 - 1) * 220;
			}
			return;
		}

		this.x += this.velocity.x * dt;
		this.y += this.velocity.y * dt;

		if (this.y < BALL / 2 || this.y > H - BALL / 2) {
			this.velocity.y *= -1;
			this.y = clamp(this.y, BALL / 2, H - BALL / 2);
		}

		if (this.x < 0 || this.x > W) {
			if (this.x < 0) score.right += 1;
			else score.left += 1;

			this.phase.send('score');
			this.reset();
		}
	}
}

class Scoreboard extends NodeUI {
	flash = 0;

	#total = 0;

	override update(): void {
		if (score.left + score.right === this.#total) return;

		this.#total = score.left + score.right;

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

const HINT = 'space to serve, W/S and arrows to move';

class Hint extends NodeUI {
	constructor(private readonly ball: Ball) {
		super('hint');
	}

	protected override intrinsicSize() {
		return { width: measureText(HINT, 18), height: 18 };
	}

	override draw(g: DrawUI): void {
		if (!this.ball.phase.is('waiting')) return;

		g.text(HINT, 0, 0, { size: 18, color: GRAY });
	}
}

class Court extends Scene {
	override ready(): void {
		this.add(new Paddle(Act.left, 40));
		this.add(new Paddle(Act.right, W - 40));

		const ball = this.add(new Ball());

		this.add(new Scoreboard('score')).place({
			anchor: Anchor.TopCenter,
			x: -120,
			y: 16,
			width: 240,
			height: 70,
		});

		this.add(new Hint(ball)).place({ anchor: Anchor.BottomCenter, x: -180, y: -40 });
	}
}

game({
	window: { width: W, height: H, title: 'kreb pong', targetFps: 60 },
	scenes: { court: Court },
	start: 'court',
	clearColor: hex(0x14171c),
}).run();
