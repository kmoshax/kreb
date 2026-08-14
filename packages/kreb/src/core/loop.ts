export type LoopOptions = {
	stepsPerSecond?: number;
	/** Upper bound on real time consumed per frame, so a paused debugger cannot spiral. */
	maxFrameSeconds?: number;
};

export type LoopCallbacks = {
	update: (dt: number) => void;
	render: (alpha: number) => void;
	shouldStop: () => boolean;
	frameTime: () => number;
};

const DEFAULT_STEPS_PER_SECOND = 60;
const DEFAULT_MAX_FRAME_SECONDS = 0.25;

/**
 * Fixed-step update with a variable render rate, so movement and collision stay
 * deterministic regardless of how fast the machine draws.
 */
export class Loop {
	readonly step: number;
	readonly #maxFrame: number;

	#accumulator = 0;

	constructor({
		stepsPerSecond = DEFAULT_STEPS_PER_SECOND,
		maxFrameSeconds = DEFAULT_MAX_FRAME_SECONDS,
	}: LoopOptions = {}) {
		this.step = 1 / stepsPerSecond;
		this.#maxFrame = maxFrameSeconds;
	}

	/** Number of fixed steps a frame of `frameSeconds` should run. */
	advance(frameSeconds: number): number {
		this.#accumulator += Math.min(frameSeconds, this.#maxFrame);

		let steps = 0;
		while (this.#accumulator >= this.step) {
			this.#accumulator -= this.step;
			steps += 1;
		}

		return steps;
	}

	/** Progress into the next pending step, for interpolated rendering later. */
	get alpha(): number {
		return this.#accumulator / this.step;
	}

	run(callbacks: LoopCallbacks): void {
		while (!callbacks.shouldStop()) {
			const steps = this.advance(callbacks.frameTime());

			for (let i = 0; i < steps; i += 1) callbacks.update(this.step);

			callbacks.render(this.alpha);
		}
	}
}
