export type TimerOptions = {
	repeat?: boolean;
	autoStart?: boolean;
};

/**
 * Ticked by whoever owns it, so the order timers fire in is visible in the
 * owner's update rather than decided by the framework.
 */
export class Timer {
	duration: number;
	repeat: boolean;

	#elapsed = 0;
	#running: boolean;
	#finished = false;

	constructor(duration: number, { repeat = false, autoStart = true }: TimerOptions = {}) {
		if (duration <= 0) throw new Error(`Timer duration must be positive, got ${duration}`);

		this.duration = duration;
		this.repeat = repeat;
		this.#running = autoStart;
	}

	get elapsed(): number {
		return this.#elapsed;
	}

	get remaining(): number {
		return Math.max(this.duration - this.#elapsed, 0);
	}

	get progress(): number {
		return Math.min(this.#elapsed / this.duration, 1);
	}

	get running(): boolean {
		return this.#running;
	}

	get finished(): boolean {
		return this.#finished;
	}

	start(): void {
		this.#running = true;
	}

	stop(): void {
		this.#running = false;
	}

	reset(): void {
		this.#elapsed = 0;
		this.#finished = false;
	}

	restart(): void {
		this.reset();
		this.start();
	}

	/** How many times the timer completed during this tick, usually 0 or 1. */
	update(dt: number): number {
		if (!this.#running || this.#finished) return 0;

		this.#elapsed += dt;
		if (this.#elapsed < this.duration) return 0;

		if (!this.repeat) {
			this.#elapsed = this.duration;
			this.#finished = true;
			this.#running = false;
			return 1;
		}

		// A long frame can span several periods; report every one of them.
		const completions = Math.floor(this.#elapsed / this.duration);
		this.#elapsed -= completions * this.duration;

		return completions;
	}
}
