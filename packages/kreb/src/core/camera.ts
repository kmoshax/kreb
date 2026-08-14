import { type Pointer, ptr } from 'bun:ffi';
import * as rl from '@kreb/raylib-sys/raylib';
import { Node2D } from './node-2d.ts';
import { Node3D } from './node-3d.ts';

export const Projection = {
	Perspective: 0,
	Orthographic: 1,
} as const;

export type Projection = (typeof Projection)[keyof typeof Projection];

/**
 * Cameras are nodes so they can be parented and inherit a transform. Each owns
 * a heap raylib camera that the render pass hands to BeginMode2D/BeginMode3D.
 */
export class Camera2D extends Node2D {
	readonly #handle: Pointer;
	readonly #fields = new Float32Array(6);

	zoom = 1;
	offset = { x: 0, y: 0 };

	constructor(name?: string) {
		super(name);

		const handle = rl.symbols().kreb_alloc_Camera2D();
		if (handle === null) throw new Error('Failed to allocate Camera2D');

		this.#handle = handle;
	}

	/** Cameras describe a pass rather than draw inside one. */
	override get space(): null {
		return null;
	}

	/** @internal */
	get handle(): Pointer {
		const { position, rotation } = this.global;

		this.#fields[0] = this.offset.x;
		this.#fields[1] = this.offset.y;
		this.#fields[2] = position.x;
		this.#fields[3] = position.y;
		this.#fields[4] = (rotation * 180) / Math.PI;
		this.#fields[5] = this.zoom;

		rl.symbols().kreb_write_Camera2D(this.#handle, ptr(this.#fields));

		return this.#handle;
	}

	override destroy(): void {
		if (this.destroyed) return;

		super.destroy();
		rl.free(this.#handle);
	}
}

export class Camera3D extends Node3D {
	readonly #handle: Pointer;
	readonly #fields = new Float32Array(11);

	target = { x: 0, y: 0, z: 0 };
	up = { x: 0, y: 1, z: 0 };
	fovY = 45;
	projection: Projection = Projection.Perspective;

	constructor(name?: string) {
		super(name);

		const handle = rl.symbols().kreb_alloc_Camera3D();
		if (handle === null) throw new Error('Failed to allocate Camera3D');

		this.#handle = handle;
	}

	override get space(): null {
		return null;
	}

	/** @internal */
	get handle(): Pointer {
		const position = this.globalPosition;

		this.#fields[0] = position.x;
		this.#fields[1] = position.y;
		this.#fields[2] = position.z;
		this.#fields[3] = this.target.x;
		this.#fields[4] = this.target.y;
		this.#fields[5] = this.target.z;
		this.#fields[6] = this.up.x;
		this.#fields[7] = this.up.y;
		this.#fields[8] = this.up.z;
		this.#fields[9] = this.fovY;
		this.#fields[10] = this.projection;

		rl.symbols().kreb_write_Camera3D(this.#handle, ptr(this.#fields));

		return this.#handle;
	}

	override destroy(): void {
		if (this.destroyed) return;

		super.destroy();
		rl.free(this.#handle);
	}
}
