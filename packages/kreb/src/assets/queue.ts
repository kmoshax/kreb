import type { AssetKind, AssetRef } from './kinds.ts';
import type { AssetScope } from './scope.ts';

export type LoadProgress = {
	loaded: number;
	total: number;
	done: boolean;
};

export type Clock = () => number;

const DEFAULT_BUDGET_SECONDS = 0.008;

/**
 * raylib's loaders are synchronous and texture upload needs the GL context on
 * the main thread, so a Promise-returning API would be theatre. This loads
 * until a per-frame time budget is spent and yields, which keeps the window
 * responsive and a progress bar moving during a loading screen.
 */
export class AssetQueue {
	readonly #scope: AssetScope;
	readonly #pending: AssetRef<AssetKind>[] = [];
	readonly #now: Clock;

	#loaded = 0;
	#total = 0;

	constructor(scope: AssetScope, now: Clock = () => performance.now() / 1000) {
		this.#scope = scope;
		this.#now = now;
	}

	enqueue(...refs: AssetRef<AssetKind>[]): this {
		this.#pending.push(...refs);
		this.#total += refs.length;

		return this;
	}

	get progress(): LoadProgress {
		return {
			loaded: this.#loaded,
			total: this.#total,
			done: this.#pending.length === 0,
		};
	}

	/**
	 * Loads whole assets until the budget is exceeded. Always loads at least one
	 * per call, so an asset slower than the entire budget cannot stall the queue.
	 */
	pump(budgetSeconds = DEFAULT_BUDGET_SECONDS): LoadProgress {
		const deadline = this.#now() + budgetSeconds;

		while (this.#pending.length > 0) {
			const ref = this.#pending.shift();
			if (!ref) break;

			this.#scope.load(ref);
			this.#loaded += 1;

			if (this.#now() >= deadline) break;
		}

		return this.progress;
	}

	/** Loads everything now, for startup paths that have no frame to yield to. */
	pumpAll(): LoadProgress {
		while (this.#pending.length > 0) this.pump(Number.POSITIVE_INFINITY);

		return this.progress;
	}
}
