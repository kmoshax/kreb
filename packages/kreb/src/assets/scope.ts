import type { AssetCache, Loaded } from './cache.ts';
import type { AssetKind, AssetRef } from './kinds.ts';

/**
 * A lifetime bracket around cache references. A scene owns one, so every asset
 * it pulled in is released together when it exits, which is what keeps handles
 * from leaking across level transitions.
 */
export class AssetScope {
	readonly #cache: AssetCache;
	readonly #held: string[] = [];

	#released = false;

	constructor(cache: AssetCache) {
		this.#cache = cache;
	}

	get size(): number {
		return this.#held.length;
	}

	get released(): boolean {
		return this.#released;
	}

	load<K extends AssetKind>(ref: AssetRef<K>): Loaded[K] {
		if (this.#released) {
			throw new Error(`Asset scope was released; cannot load ${ref.path}`);
		}

		const asset = this.#cache.acquire(ref);
		this.#held.push(ref.path);

		return asset;
	}

	releaseAll(): void {
		if (this.#released) return;

		this.#released = true;
		for (const path of this.#held) this.#cache.release(path);

		this.#held.length = 0;
	}

	[Symbol.dispose](): void {
		this.releaseAll();
	}
}
