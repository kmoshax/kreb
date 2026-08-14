import {
	type Matrix,
	MatrixIdentity,
	MatrixMultiply,
	MatrixScale,
	MatrixTranslate,
	QuaternionToMatrix,
} from '@kreb/math';
import type { Draw3D } from '../draw/context.ts';
import { Node, RenderSpace } from './node.ts';
import { TrackedQuaternion, TrackedVector3 } from './tracked.ts';

/**
 * 3D keeps a matrix rather than components because raylib's DrawModelEx takes
 * position, axis, angle and scale, which cannot express a nested or sheared
 * hierarchy. Writing the composed matrix into model.transform can.
 */
export type Node3DOptions = {
	name?: string;
	at?: readonly [number, number, number];
	scale?: readonly [number, number, number];
};

export class Node3D extends Node {
	readonly position: TrackedVector3;
	readonly rotation: TrackedQuaternion;
	readonly scale: TrackedVector3;

	#dirty = true;
	#global: Matrix = MatrixIdentity();

	constructor(options: Node3DOptions | string = {}) {
		const settings = typeof options === 'string' ? { name: options } : options;
		super(settings.name);

		const invalidate = () => this.onTransformChanged();
		const at = settings.at ?? [0, 0, 0];
		const scale = settings.scale ?? [1, 1, 1];

		this.position = new TrackedVector3(at[0], at[1], at[2], invalidate);
		this.rotation = new TrackedQuaternion(0, 0, 0, 1, invalidate);
		this.scale = new TrackedVector3(scale[0], scale[1], scale[2], invalidate);
	}

	at(x: number, y: number, z: number): this {
		this.position.set({ x, y, z });
		return this;
	}

	override get space(): RenderSpace | null {
		return RenderSpace.World3D;
	}

	get globalTransform(): Matrix {
		if (this.#dirty) this.recompute();

		return this.#global;
	}

	get globalPosition(): { x: number; y: number; z: number } {
		const m = this.globalTransform;

		return { x: m[12] as number, y: m[13] as number, z: m[14] as number };
	}

	draw(_g: Draw3D): void {}

	protected override onTransformChanged(): void {
		this.#dirty = true;
		super.onTransformChanged();
	}

	#parent3D(): Node3D | null {
		for (let node = this.parent; node; node = node.parent) {
			if (node instanceof Node3D) return node;
		}

		return null;
	}

	private recompute(): void {
		this.#dirty = false;

		// MatrixMultiply(a, b) applies a first, so scale, then rotate, then move.
		const local = MatrixMultiply(
			MatrixMultiply(
				MatrixScale(this.scale.x, this.scale.y, this.scale.z),
				QuaternionToMatrix(this.rotation),
			),
			MatrixTranslate(this.position.x, this.position.y, this.position.z),
		);

		const parent = this.#parent3D();
		this.#global = parent ? MatrixMultiply(local, parent.globalTransform) : local;
	}
}
