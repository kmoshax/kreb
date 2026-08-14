import type { Vector2, Vector3 } from '@kreb/math';
import { components } from '@kreb/math';
import { Node2D } from '../core/node-2d.ts';
import { Node3D } from '../core/node-3d.ts';
import { ALL_LAYERS, DEFAULT_LAYER } from './layers.ts';
import { type Bounds, boundsOf, type Volume } from './volume.ts';

export type ColliderOptions = {
	layer?: number;
	mask?: number;
	/** Reports overlaps without being treated as solid by future dynamics. */
	sensor?: boolean;
};

let nextId = 1;

export interface Collider {
	readonly id: number;
	readonly name: string;
	layer: number;
	mask: number;
	sensor: boolean;
	readonly volume: Volume;
	readonly bounds: Bounds;
	onEnter(other: Collider): void;
	onExit(other: Collider): void;
}

function applyOptions(target: Collider, options: ColliderOptions): void {
	target.layer = options.layer ?? DEFAULT_LAYER;
	target.mask = options.mask ?? ALL_LAYERS;
	target.sensor = options.sensor ?? true;
}

export abstract class Collider2D extends Node2D implements Collider {
	readonly id = nextId++;

	layer = DEFAULT_LAYER;
	mask = ALL_LAYERS;
	sensor = true;

	abstract get volume(): Volume;

	get bounds(): Bounds {
		return boundsOf(this.volume);
	}

	onEnter(_other: Collider): void {}

	onExit(_other: Collider): void {}
}

export class BoxCollider2D extends Collider2D {
	size: Vector2;

	constructor(size: Vector2, options: ColliderOptions = {}, name?: string) {
		super(name);

		this.size = size;
		applyOptions(this, options);
	}

	get volume(): Volume {
		const { position, scale } = this.global;

		return {
			kind: 'box',
			center: [position.x, position.y],
			half: [(this.size.x * Math.abs(scale.x)) / 2, (this.size.y * Math.abs(scale.y)) / 2],
		};
	}
}

export class CircleCollider2D extends Collider2D {
	radius: number;

	constructor(radius: number, options: ColliderOptions = {}, name?: string) {
		super(name);

		this.radius = radius;
		applyOptions(this, options);
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

	constructor(size: Vector3, options: ColliderOptions = {}, name?: string) {
		super(name);

		this.size = size;
		applyOptions(this, options);
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

	constructor(radius: number, options: ColliderOptions = {}, name?: string) {
		super(name);

		this.radius = radius;
		applyOptions(this, options);
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
