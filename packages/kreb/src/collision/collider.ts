import type { Vector2, Vector3 } from '@kreb/math';
import { components } from '@kreb/math';
import { Node2D, type Node2DOptions } from '../core/node-2d.ts';
import { Node3D, type Node3DOptions } from '../core/node-3d.ts';
import type { Draw2D, Draw3D } from '../draw/context.ts';
import { ALL_LAYERS, DEFAULT_LAYER } from './layers.ts';
import { type Bounds, boundsOf, type Volume } from './volume.ts';

export type ColliderOptions = {
	layer?: number;
	mask?: number;
	/** Reports overlaps without being treated as solid by future dynamics. */
	sensor?: boolean;
	/** When set, the collider draws its own shape. Unset means invisible. */
	color?: number;
};

export type BoxCollider2DOptions = ColliderOptions &
	Node2DOptions & { size: readonly [number, number] };

export type CircleCollider2DOptions = ColliderOptions & Node2DOptions & { radius: number };

export type BoxCollider3DOptions = ColliderOptions &
	Node3DOptions & { size: readonly [number, number, number] };

export type SphereCollider3DOptions = ColliderOptions & Node3DOptions & { radius: number };

let nextId = 1;

export interface Collider {
	readonly id: number;
	readonly name: string;
	layer: number;
	mask: number;
	sensor: boolean;
	readonly volume: Volume;
	readonly bounds: Bounds;
	color: number | null;
	onEnter(other: Collider): void;
	onExit(other: Collider): void;
}

function applyOptions(target: Collider, options: ColliderOptions): void {
	target.layer = options.layer ?? DEFAULT_LAYER;
	target.mask = options.mask ?? ALL_LAYERS;
	target.sensor = options.sensor ?? true;
	target.color = options.color ?? null;
}

export abstract class Collider2D extends Node2D implements Collider {
	readonly id = nextId++;

	layer = DEFAULT_LAYER;
	mask = ALL_LAYERS;
	sensor = true;
	color: number | null = null;

	abstract get volume(): Volume;

	get bounds(): Bounds {
		return boundsOf(this.volume);
	}

	onEnter(_other: Collider): void {}

	onExit(_other: Collider): void {}
}

export class BoxCollider2D extends Collider2D {
	size: Vector2;

	constructor(options: BoxCollider2DOptions) {
		super(options);

		this.size = { x: options.size[0], y: options.size[1] };
		applyOptions(this, options);
	}

	override draw(g: Draw2D): void {
		if (this.color === null) return;

		g.rect(-this.size.x / 2, -this.size.y / 2, this.size.x, this.size.y, { color: this.color });
	}

	/** Half the world-space size, which is what offset maths usually wants. */
	get extents(): Vector2 {
		const { scale } = this.global;

		return { x: (this.size.x * Math.abs(scale.x)) / 2, y: (this.size.y * Math.abs(scale.y)) / 2 };
	}

	get volume(): Volume {
		const { position } = this.global;
		const { x, y } = this.extents;

		return { kind: 'box', center: [position.x, position.y], half: [x, y] };
	}
}

export class CircleCollider2D extends Collider2D {
	radius: number;

	constructor(options: CircleCollider2DOptions) {
		super(options);

		this.radius = options.radius;
		applyOptions(this, options);
	}

	override draw(g: Draw2D): void {
		if (this.color === null) return;

		g.circle({ x: 0, y: 0 }, this.radius, { color: this.color });
	}

	get volume(): Volume {
		const { position, scale } = this.global;

		return {
			kind: 'sphere',
			center: [position.x, position.y],
			radius: this.radius * Math.max(Math.abs(scale.x), Math.abs(scale.y)),
		};
	}
}

export abstract class Collider3D extends Node3D implements Collider {
	readonly id = nextId++;

	layer = DEFAULT_LAYER;
	mask = ALL_LAYERS;
	sensor = true;
	color: number | null = null;

	abstract get volume(): Volume;

	get bounds(): Bounds {
		return boundsOf(this.volume);
	}

	onEnter(_other: Collider): void {}

	onExit(_other: Collider): void {}

	/** Column lengths of the world matrix, which is the accumulated scale. */
	protected worldScale(): [number, number, number] {
		const m = components(this.globalTransform);

		return [
			Math.hypot(m[0], m[1], m[2]),
			Math.hypot(m[4], m[5], m[6]),
			Math.hypot(m[8], m[9], m[10]),
		];
	}
}

export class BoxCollider3D extends Collider3D {
	size: Vector3;

	constructor(options: BoxCollider3DOptions) {
		super(options);

		this.size = { x: options.size[0], y: options.size[1], z: options.size[2] };
		applyOptions(this, options);
	}

	override draw(g: Draw3D): void {
		if (this.color === null) return;

		g.cube(this.size, { color: this.color });
	}

	get volume(): Volume {
		const position = this.globalPosition;
		const [sx, sy, sz] = this.worldScale();

		return {
			kind: 'box',
			center: [position.x, position.y, position.z],
			half: [(this.size.x * sx) / 2, (this.size.y * sy) / 2, (this.size.z * sz) / 2],
		};
	}
}

export class SphereCollider3D extends Collider3D {
	radius: number;

	constructor(options: SphereCollider3DOptions) {
		super(options);

		this.radius = options.radius;
		applyOptions(this, options);
	}

	override draw(g: Draw3D): void {
		if (this.color === null) return;

		g.sphere(this.radius, { color: this.color });
	}

	get volume(): Volume {
		const position = this.globalPosition;
		const [sx, sy, sz] = this.worldScale();

		return {
			kind: 'sphere',
			center: [position.x, position.y, position.z],
			radius: this.radius * Math.max(sx, sy, sz),
		};
	}
}

export function isCollider(value: unknown): value is Collider {
	return value instanceof Collider2D || value instanceof Collider3D;
}
