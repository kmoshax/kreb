import { RAYWHITE } from '@kreb/raylib-sys/colors';
import * as rl from '@kreb/raylib-sys/raylib';
import { Loop } from './core/loop.ts';
import type { Rect } from './core/node-ui.ts';
import { RenderQueue } from './core/render-queue.ts';
import { Draw2DContext, Draw3DContext, DrawUIContext } from './draw/contexts.ts';
import { input } from './input/input.ts';
import type { Scene } from './scene/scene.ts';
import { SceneManager } from './scene/scene.ts';
import { readUiInput } from './ui/read-input.ts';

export type WindowOptions = {
	width: number;
	height: number;
	title: string;
	targetFps?: number;
	hidden?: boolean;
};

export type GameOptions<Scenes extends Record<string, new () => Scene>> = {
	window: WindowOptions;
	scenes: Scenes;
	start: keyof Scenes & string;
	clearColor?: number;
	stepsPerSecond?: number;
};

const FLAG_WINDOW_HIDDEN = 0x00000080;

export class Game<Scenes extends Record<string, new () => Scene>> {
	readonly scenes = new SceneManager();

	readonly #options: GameOptions<Scenes>;
	readonly #loop: Loop;
	readonly #queue = new RenderQueue();
	readonly #draw2d = new Draw2DContext();
	readonly #draw3d = new Draw3DContext();
	readonly #drawUi = new DrawUIContext();

	#running = false;

	constructor(options: GameOptions<Scenes>) {
		this.#options = options;
		this.#loop = new Loop({ stepsPerSecond: options.stepsPerSecond });
	}

	/** Opens the window and runs until the scene stack empties or the user quits. */
	run(): void {
		this.open();

		try {
			this.#loop.run({
				shouldStop: () => rl.WindowShouldClose(),
				frameTime: () => rl.GetFrameTime(),
				beginFrame: () => input.beginFrame(),
				beginStep: () => input.beginStep(),
				update: (dt) => this.update(dt),
				render: () => this.render(),
			});
		} finally {
			this.close();
		}
	}

	/** @internal Exposed so tests can drive frames without owning the loop. */
	open(): void {
		if (this.#running) return;

		// Validate before opening anything, so a bad config cannot leave a window
		// on screen or the game marked running with no scene.
		const Start = this.#options.scenes[this.#options.start];
		if (!Start) {
			const known = Object.keys(this.#options.scenes).join(', ');
			throw new Error(`Unknown start scene "${this.#options.start}". Known scenes: ${known}`);
		}

		const { width, height, title, targetFps, hidden } = this.#options.window;

		if (hidden) rl.SetConfigFlags(FLAG_WINDOW_HIDDEN);
		rl.InitWindow(width, height, title);

		if (!rl.IsWindowReady()) {
			throw new Error(`Failed to open a ${width}x${height} window`);
		}

		if (targetFps) rl.SetTargetFPS(targetFps);
		this.#running = true;

		this.scenes.change(new Start());
	}

	/** @internal */
	update(dt: number): void {
		const scene = this.scenes.active;

		scene.ui.collect(scene);
		scene.ui.step(this.viewport(), readUiInput());

		scene.updateTree(dt);
		scene.tweens.update(dt);

		// After movement, so callbacks see the positions the step produced.
		scene.collisions.collect(scene);
		scene.collisions.step();
	}

	/** @internal */
	render(): void {
		const viewport = this.viewport();

		rl.BeginDrawing();
		rl.ClearBackground(this.#options.clearColor ?? RAYWHITE);

		// Every scene on the stack draws, so a pushed pause menu overlays the
		// level rather than replacing it.
		for (const scene of this.scenes.stack) this.#renderScene(scene, viewport);

		rl.EndDrawing();
	}

	#renderScene(scene: Scene, viewport: Rect): void {
		this.#queue.collect(scene);
		this.#queue.sort(scene.camera3d?.globalPosition ?? null);

		if (scene.camera3d && this.#queue.world3d.length > 0) {
			const camera = scene.camera3d.handle;

			rl.BeginMode3D(camera);

			for (const node of this.#queue.world3d) {
				this.#draw3d.bind(node.globalTransform, node.globalPosition, camera);
				node.draw(this.#draw3d);
			}

			rl.EndMode3D();
		}

		if (this.#queue.world2d.length > 0) {
			if (scene.camera2d) rl.BeginMode2D(scene.camera2d.handle);

			for (const node of this.#queue.world2d) {
				this.#draw2d.bind(node);
				node.draw(this.#draw2d);
			}

			if (scene.camera2d) rl.EndMode2D();
		}

		for (const node of this.#queue.ui) {
			this.#drawUi.bind(node.resolve(viewport));
			node.draw(this.#drawUi);
		}
	}

	/** @internal */
	viewport(): Rect {
		return { x: 0, y: 0, width: rl.GetScreenWidth(), height: rl.GetScreenHeight() };
	}

	/** @internal */
	close(): void {
		if (!this.#running) return;

		while (this.scenes.depth > 0) this.scenes.pop();

		rl.CloseWindow();
		this.#running = false;
	}
}

export function game<Scenes extends Record<string, new () => Scene>>(
	options: GameOptions<Scenes>,
): Game<Scenes> {
	return new Game(options);
}
