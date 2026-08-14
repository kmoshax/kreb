import type { Camera2D, Camera3D } from '../core/camera.ts';
import { Node } from '../core/node.ts';

export class Scene extends Node {
	camera2d: Camera2D | null = null;
	camera3d: Camera3D | null = null;

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
	}
}
