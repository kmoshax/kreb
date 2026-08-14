import type { Bounds } from './volume.ts';

const DEFAULT_CELL_SIZE = 64;

/**
 * Uniform grid broadphase, parameterized over dimension so 2D and 3D share it.
 * Cells are keyed by their integer coordinates joined into a string, which is
 * cheap enough at the scales a game reaches and avoids hand-rolled hashing.
 */
export class SpatialHash<T> {
	readonly cellSize: number;

	readonly #cells = new Map<string, T[]>();
	readonly #bounds = new Map<T, Bounds>();

	constructor(cellSize = DEFAULT_CELL_SIZE) {
		if (cellSize <= 0) throw new Error(`Spatial hash cell size must be positive, got ${cellSize}`);

		this.cellSize = cellSize;
	}

	get size(): number {
		return this.#bounds.size;
	}

	get cellCount(): number {
		return this.#cells.size;
	}

	clear(): void {
		this.#cells.clear();
		this.#bounds.clear();
	}

	insert(item: T, bounds: Bounds): void {
		this.#bounds.set(item, bounds);

		for (const key of this.#keysFor(bounds)) {
			const cell = this.#cells.get(key);
			if (cell) cell.push(item);
			else this.#cells.set(key, [item]);
		}
	}

	/** Everything sharing a cell with `bounds`, deduplicated, excluding `self`. */
	candidates(bounds: Bounds, self?: T): T[] {
		const found = new Set<T>();

		for (const key of this.#keysFor(bounds)) {
			for (const item of this.#cells.get(key) ?? []) {
				if (item !== self) found.add(item);
			}
		}

		return [...found];
	}

	boundsOf(item: T): Bounds | undefined {
		return this.#bounds.get(item);
	}

	#keysFor(bounds: Bounds): string[] {
		const dimensions = bounds.min.length;

		const low: number[] = [];
		const high: number[] = [];

		for (let i = 0; i < dimensions; i += 1) {
			low.push(Math.floor((bounds.min[i] as number) / this.cellSize));
			high.push(Math.floor((bounds.max[i] as number) / this.cellSize));
		}

		let keys = [''];

		for (let i = 0; i < dimensions; i += 1) {
			const next: string[] = [];

			for (let c = low[i] as number; c <= (high[i] as number); c += 1) {
				for (const prefix of keys) next.push(`${prefix}${c},`);
			}

			keys = next;
		}

		return keys;
	}
}
