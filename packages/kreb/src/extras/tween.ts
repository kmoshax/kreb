import { Ease, type EaseFn } from './ease.ts';

export type TweenOptions = {
	delay?: number;
	repeat?: number;
	pingPong?: boolean;
};

export class Tween {
	readonly duration: number;
	readonly ease: EaseFn;

	#apply: (t: number) => void;
	#onDone: (() => void) | null = null;

	#elapsed = 0;
	#delay: number;
	#remainingRepeats: number;
	#pingPong: boolean;
	#reversing = false;
	#done = false;
	#cancelled = false;

	constructor(
		duration: number,
		ease: EaseFn,
		apply: (t: number) => void,
		{ delay = 0, repeat = 0, pingPong = false }: TweenOptions = {},
	) {
		if (duration <= 0) throw new Error(`Tween duration must be positive, got ${duration}`);

		this.duration = duration;
		this.ease = ease;
		this.#apply = apply;
		this.#delay = delay;
		this.#remainingRepeats = repeat;
		this.#pingPong = pingPong;
	}

	get done(): boolean {
		return this.#done;
	}

	get cancelled(): boolean {
		return this.#cancelled;
	}

	onDone(callback: () => void): this {
		this.#onDone = callback;
		return this;
	}

	cancel(): void {
		if (this.#done) return;

		this.#cancelled = true;
		this.#done = true;
	}

	/** @internal */
	update(dt: number): void {
		if (this.#done) return;

		if (this.#delay > 0) {
			this.#delay -= dt;
			if (this.#delay > 0) return;

			dt = -this.#delay;
			this.#delay = 0;
		}

		this.#elapsed += dt;

		while (this.#elapsed >= this.duration) {
			if (this.#pingPong && !this.#reversing) {
				this.#reversing = true;
				this.#elapsed -= this.duration;
				continue;
			}

			if (this.#remainingRepeats > 0) {
				this.#remainingRepeats -= 1;
				this.#reversing = false;
				this.#elapsed -= this.duration;
				continue;
			}

			// Land exactly on the end value rather than wherever the frame fell.
			this.#apply(this.ease(this.#reversing ? 0 : 1));
			this.#done = true;
			this.#onDone?.();
			return;
		}

		const linear = this.#elapsed / this.duration;
		this.#apply(this.ease(this.#reversing ? 1 - linear : linear));
	}
}

/**
 * Callback form rather than property names: `tween(obj, { x: 100 })` needs
 * string keys and loses type safety on nested paths, while a callback is fully
 * typed and can drive a color, a shader uniform or three values at once.
 */
export class TweenRunner {
	#tweens: Tween[] = [];

	get active(): number {
		return this.#tweens.length;
	}

	run(duration: number, ease: EaseFn, apply: (t: number) => void, options?: TweenOptions): Tween {
		const tween = new Tween(duration, ease, apply, options);
		this.#tweens.push(tween);

		return tween;
	}

	/** Convenience for the common case of interpolating one number. */
	to(
		duration: number,
		from: number,
		to: number,
		apply: (value: number) => void,
		ease: EaseFn = Ease.Linear,
	): Tween {
		return this.run(duration, ease, (t) => apply(from + (to - from) * t));
	}

	update(dt: number): void {
		for (const tween of this.#tweens) tween.update(dt);

		if (this.#tweens.some((tween) => tween.done)) {
			this.#tweens = this.#tweens.filter((tween) => !tween.done);
		}
	}

	cancelAll(): void {
		for (const tween of this.#tweens) tween.cancel();

		this.#tweens.length = 0;
	}
}
