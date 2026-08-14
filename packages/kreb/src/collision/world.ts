import type { Node } from '../core/node.ts';
import { type Collider, isCollider } from './collider.ts';
import { ALL_LAYERS, interested } from './layers.ts';
import { SpatialHash } from './spatial-hash.ts';
import {
	type Bounds,
	boundsOf,
	overlaps,
	type RayResult,
	rayVolume,
	type Volume,
} from './volume.ts';

export type Overlap = {
	collider: Collider;
};

export type RayHit =
	| {
			hit: true;
			collider: Collider;
			distance: number;
			point: readonly number[];
			normal: readonly number[];
	  }
	| { hit: false };

export type QueryOptions = {
	mask?: number;
	maxDistance?: number;
};

const NO_HIT: RayHit = { hit: false };

function pairKey(a: Collider, b: Collider): string {
	return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
}

/**
 * Detection, queries and callbacks. No mass, restitution or solver: rigid-body
 * dynamics is a project the size of the rest of the framework, and wrapping
 * Rapier is the sane path if it is ever wanted.
 */
export class CollisionWorld {
	readonly #hash2d: SpatialHash<Collider>;
	readonly #hash3d: SpatialHash<Collider>;

	readonly #colliders: Collider[] = [];
	#touching = new Set<string>();
	readonly #byKey = new Map<string, [Collider, Collider]>();

	constructor(cellSize2d = 64, cellSize3d = 4) {
		this.#hash2d = new SpatialHash(cellSize2d);
		this.#hash3d = new SpatialHash(cellSize3d);
	}

	get size(): number {
		return this.#colliders.length;
	}

	/** Rebuilds from the tree, the same way the render queue collects drawables. */
	collect(root: Node): void {
		this.#colliders.length = 0;
		this.#hash2d.clear();
		this.#hash3d.clear();

		this.#walk(root);

		for (const collider of this.#colliders) {
			const bounds = collider.bounds;
			this.#hashFor(bounds).insert(collider, bounds);
		}
	}

	/** Diffs against last frame and fires onEnter/onExit on interested sides. */
	step(): void {
		const current = new Set<string>();
		const pairs = new Map<string, [Collider, Collider]>();

		for (const collider of this.#colliders) {
			const bounds = collider.bounds;
			const hash = this.#hashFor(bounds);

			for (const other of hash.candidates(bounds, collider)) {
				const key = pairKey(collider, other);
				if (current.has(key)) continue;

				if (!interested(collider.layer, collider.mask, other.layer, other.mask)) continue;
				if (!overlaps(collider.volume, other.volume)) continue;

				current.add(key);
				pairs.set(key, [collider, other]);
			}
		}

		for (const [key, [a, b]] of pairs) {
			if (this.#touching.has(key)) continue;

			if ((a.mask & b.layer) !== 0) a.onEnter(b);
			if ((b.mask & a.layer) !== 0) b.onEnter(a);
		}

		for (const key of this.#touching) {
			if (current.has(key)) continue;

			const previous = this.#byKey.get(key);
			if (!previous) continue;

			const [a, b] = previous;
			if ((a.mask & b.layer) !== 0) a.onExit(b);
			if ((b.mask & a.layer) !== 0) b.onExit(a);
		}

		this.#touching = current;
		this.#byKey.clear();
		for (const [key, pair] of pairs) this.#byKey.set(key, pair);
	}

	/** Everything currently overlapping `collider`. Empty when nothing does. */
	overlapping(collider: Collider, mask = ALL_LAYERS): Overlap[] {
		const bounds = collider.bounds;
		const found: Overlap[] = [];

		for (const other of this.#hashFor(bounds).candidates(bounds, collider)) {
			if ((mask & other.layer) === 0) continue;
			if (!overlaps(collider.volume, other.volume)) continue;

			found.push({ collider: other });
		}

		return found;
	}

	/** Everything overlapping a free-standing volume. Empty when nothing does. */
	overlapVolume(volume: Volume, mask = ALL_LAYERS): Overlap[] {
		const bounds = boundsOf(volume);
		const found: Overlap[] = [];

		for (const other of this.#hashFor(bounds).candidates(bounds)) {
			if ((mask & other.layer) === 0) continue;
			if (!overlaps(volume, other.volume)) continue;

			found.push({ collider: other });
		}

		return found;
	}

	/**
	 * Nearest hit along the ray. Returns `{ hit: false }` rather than null so
	 * callers narrow on a discriminant instead of guarding for absence.
	 */
	raycast(
		origin: readonly number[],
		direction: readonly number[],
		options: QueryOptions = {},
	): RayHit {
		const maxDistance = options.maxDistance ?? Number.POSITIVE_INFINITY;
		const mask = options.mask ?? ALL_LAYERS;

		const unit = normalize(direction);
		if (!unit) return NO_HIT;

		let best: RayHit = NO_HIT;

		// Every collider of the matching dimension is tested: walking the grid
		// along the ray is the optimisation, and it is not needed yet.
		for (const collider of this.#colliders) {
			if (collider.volume.center.length !== origin.length) continue;
			if ((mask & collider.layer) === 0) continue;

			const result: RayResult = rayVolume(origin, unit, collider.volume, maxDistance);
			if (!result.hit) continue;

			if (!best.hit || result.distance < best.distance) {
				best = { ...result, hit: true, collider };
			}
		}

		return best;
	}

	#hashFor(bounds: Bounds): SpatialHash<Collider> {
		return bounds.min.length === 2 ? this.#hash2d : this.#hash3d;
	}

	#walk(node: Node): void {
		if (node.destroyed) return;

		if (isCollider(node)) this.#colliders.push(node);

		for (const child of node.children) this.#walk(child);
	}
}

function normalize(direction: readonly number[]): number[] | null {
	const length = Math.hypot(...direction);
	if (length === 0) return null;

	return direction.map((value) => value / length);
}
