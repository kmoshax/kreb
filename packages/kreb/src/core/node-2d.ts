import type { Vector2 } from '@kreb/math';
import type { Draw2D } from '../draw/context.ts';
import { Node, RenderSpace } from './node.ts';
import { TrackedVector2 } from './tracked.ts';

export type Transform2D = {
	position: Vector2;
	rotation: number;
	scale: Vector2;
};

/**
 * 2D composes component-wise rather than through a matrix: raylib's 2D draw
 * calls take position, rotation and scale directly, so keeping them separate
 * avoids decomposing a matrix on every draw.
 */
export class Node2D extends Node {
	readonly position: TrackedVector2;
	readonly scale: TrackedVector2;

	zIndex = 0;

	#rotation = 0;
	#dirty = true;
	readonly #global: Transform2D = {
		position: { x: 0, y: 0 },
		rotation: 0,
		scale: { x: 1, y: 1 },
	};

	constructor(name?: string) {
		super(name);

		const invalidate = () => this.onTransformChanged();
		this.position = new TrackedVector2(0, 0, invalidate);
		this.scale = new TrackedVector2(1, 1, invalidate);
	}

	override get space(): RenderSpace | null {
		return RenderSpace.World2D;
	}

	get rotation(): number {
		return this.#rotation;
	}

	set rotation(value: number) {
		if (value === this.#rotation) return;

		this.#rotation = value;
		this.onTransformChanged();
	}

	/** World-space transform, recomputed only after something upstream moves. */
	get global(): Readonly<Transform2D> {
		if (this.#dirty) this.recompute();

		return this.#global;
	}

	draw(_g: Draw2D): void {}

	protected override onTransformChanged(): void {
		this.#dirty = true;
		super.onTransformChanged();
	}

	/**
	 * Composes against the nearest Node2D ancestor rather than the direct parent,
	 * so a Node2D parented under a Node3D keeps a well-defined 2D transform.
	 */
	#parent2D(): Node2D | null {
		for (let node = this.parent; node; node = node.parent) {
			if (node instanceof Node2D) return node;
		}

		return null;
	}

	private recompute(): void {
		this.#dirty = false;

		const parent = this.#parent2D();

		if (!parent) {
			this.#global.position.x = this.position.x;
			this.#global.position.y = this.position.y;
			this.#global.rotation = this.#rotation;
			this.#global.scale.x = this.scale.x;
			this.#global.scale.y = this.scale.y;
			return;
		}

		const base = parent.global;

		const scaledX = this.position.x * base.scale.x;
		const scaledY = this.position.y * base.scale.y;

		const cos = Math.cos(base.rotation);
		const sin = Math.sin(base.rotation);

		this.#global.position.x = base.position.x + scaledX * cos - scaledY * sin;
		this.#global.position.y = base.position.y + scaledX * sin + scaledY * cos;
		this.#global.rotation = base.rotation + this.#rotation;
		this.#global.scale.x = base.scale.x * this.scale.x;
		this.#global.scale.y = base.scale.y * this.scale.y;
	}
}
