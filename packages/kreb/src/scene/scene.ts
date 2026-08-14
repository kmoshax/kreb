import { AssetCache } from '../assets/cache.ts';
import { AssetScope } from '../assets/scope.ts';
import { CollisionWorld } from '../collision/world.ts';
import type { Camera2D, Camera3D } from '../core/camera.ts';
import { Node } from '../core/node.ts';
import { TweenRunner } from '../extras/tween.ts';
import { UiSystem } from '../ui/system.ts';

/** Outlives every scene, so a shared texture is loaded once and reused. */
export const assetCache = new AssetCache();

export class Scene extends Node {
	camera2d: Camera2D | null = null;
	camera3d: Camera3D | null = null;

	readonly assets = new AssetScope(assetCache);
	readonly collisions = new CollisionWorld();
	readonly ui = new UiSystem();
	readonly tweens = new TweenRunner();

	/** Runs once when the scene becomes active, before its first update. */
	override ready(): void {}

	/** Runs when the scene is replaced or popped, before its nodes leave the tree. */
	override exitTree(): void {}
}

export class SceneManager {
	readonly #stack: Scene[] = [];

	get active(): Scene {
		const scene = this.#stack.at(-1);
		if (!scene) throw new Error('No active scene. Call change() before running the loop.');

		return scene;
	}

	get depth(): number {
		return this.#stack.length;
	}

	/** Bottom to top. Only the top scene updates; all of them draw. */
	get stack(): readonly Scene[] {
		return this.#stack;
	}

	/** Replaces the whole stack, tearing down every scene currently on it. */
	change(scene: Scene): void {
		while (this.#stack.length > 0) this.pop();

		this.push(scene);
	}

	/** Overlays a scene, leaving the one below alive but no longer updated. */
	push(scene: Scene): void {
		this.#stack.push(scene);
		scene.enterTree();
	}

	pop(): void {
		const scene = this.#stack.pop();
		if (!scene) return;

		scene.leaveTree();
		scene.destroy();
		scene.assets.releaseAll();
	}
}
