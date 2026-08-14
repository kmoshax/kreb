// Manual check: bun packages/kreb/examples/demo.ts

import {
	Anchor,
	actions,
	axis2,
	Button,
	Camera2D,
	Camera3D,
	Checkbox,
	DARKBLUE,
	type Draw2D,
	type Draw3D,
	type DrawUI,
	Ease,
	fsm,
	GOLD,
	game,
	Image,
	input,
	Key,
	Label,
	MAROON,
	Mesh,
	Model,
	Node2D,
	Node3D,
	NodeUI,
	Panel,
	ParticleEmitter2D,
	RAYWHITE,
	Scene,
	SKYBLUE,
	Slider,
	TextInput,
	Texture,
	Timer,
	WHITE,
} from 'kreb';

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
		this.#spin += this.speed * cubeSpeed * dt;

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
		if (!showGrid) return;

		for (let i = -5; i <= 5; i += 1) {
			g.line({ x: i, y: 0, z: -5 }, { x: i, y: 0, z: 5 }, { color: DARKBLUE });
			g.line({ x: -5, y: 0, z: i }, { x: 5, y: 0, z: i }, { color: DARKBLUE });
		}
	}
}

class Player extends Node2D {
	readonly texture = Texture.fromImage(Image.color(48, 48, MAROON));

	readonly motion = fsm({
		idle: { move: 'moving' },
		moving: { halt: 'idle' },
	});

	readonly trail = this.add(
		new ParticleEmitter2D({
			rate: 90,
			lifetime: { min: 0.3, max: 0.7 },
			speed: { min: 20, max: 70 },
			size: { start: 7, end: 0 },
			color: { start: 0x4f8cf7ff, end: 0x4f8cf700 },
			gravity: [0, 140],
		}),
	);

	readonly #velocity = { x: 220, y: 160 };

	#driven = false;

	override update(dt: number): void {
		const direction = input.axis(Act.move);
		const moving = direction.x !== 0 || direction.y !== 0;

		this.motion.send(moving ? 'move' : 'halt');
		this.trail.system.stop();
		if (moving) this.trail.system.start();

		if (moving) {
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
	pulse = 0;

	readonly beat = new Timer(1, { repeat: true });

	override update(dt: number): void {
		this.frames += 1;
		if (input.pressed(Act.jump)) this.jumps += 1;

		// The scene's runner drives the tween; the timer decides when to start one.
		if (this.beat.update(dt) > 0) {
			this.scene.tweens.run(0.6, Ease.OutCubic, (t) => {
				this.pulse = 1 - t;
			});
		}
	}

	override draw(g: DrawUI): void {
		g.rect(0, 0, g.width, g.height, { color: DARKBLUE });
		g.text('WASD · shift · space', 10, 8, { size: 20, color: RAYWHITE });
		g.text(`${playerName} · ${this.jumps} jumps`, 10, 32, { size: 16, color: WHITE });
		g.rect(0, g.height - 8, g.width * this.pulse, 4, { color: GOLD });
	}
}

class Settings extends Scene {
	onClose: () => void = () => {};

	override ready(): void {
		const panel = this.add(new Panel('panel'));
		panel.place({ anchor: Anchor.Center, x: -200, y: -160, width: 400, height: 320 });

		const title = panel.add(new Label('Settings', 'title'));
		title.place({ x: 24, y: 20, width: 200, height: 28 });

		const fullscreen = panel.add(new Checkbox('Grid overlay', true, 'grid'));
		fullscreen.place({ x: 24, y: 70, width: 320, height: 28 });
		fullscreen.onChange = (on) => {
			showGrid = on;
		};

		const volumeLabel = panel.add(new Label('Cube speed', 'volumeLabel'));
		volumeLabel.muted = true;
		volumeLabel.place({ x: 24, y: 118, width: 200, height: 24 });

		const speed = panel.add(new Slider(cubeSpeed, 0, 3, 'speed'));
		speed.place({ x: 24, y: 146, width: 352, height: 24 });
		speed.onChange = (value) => {
			cubeSpeed = value;
		};

		const name = panel.add(new TextInput(playerName, 'name'));
		name.placeholder = 'player name';
		name.place({ x: 24, y: 190, width: 352, height: 32 });
		name.onChange = (value) => {
			playerName = value;
		};

		const close = panel.add(new Button('Close', () => this.onClose(), 'close'));
		close.place({ x: 24, y: 248, width: 352, height: 40 });
	}
}

let showGrid = true;
let cubeSpeed = 1.1;
let playerName = 'kreb';

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
		hud.place({ anchor: Anchor.TopLeft, x: 12, y: 12, width: 240, height: 62 });

		const open = this.add(
			new Button('Settings', () => {
				const settings = new Settings('settings');
				settings.onClose = () => running.scenes.pop();
				running.scenes.push(settings);
			}),
		);
		open.place({ anchor: Anchor.TopRight, x: -152, y: 12 });
	}
}

const running = game({
	window: { width: WIDTH, height: HEIGHT, title: 'kreb', targetFps: 60 },
	scenes: { level: Level },
	start: 'level',
});

running.run();
