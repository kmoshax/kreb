import type { Vector2 } from '@kreb/math';
import type { Action, Axis2Action, Binding, ButtonAction } from './bindings.ts';
import type { InputDevice } from './device.ts';
import { raylibDevice } from './device.ts';

const DEFAULT_DEADZONE = 0.2;

export type InputOptions = {
	device?: InputDevice;
	deadzone?: number;
};

/**
 * raylib polls input once per frame, but a fixed-timestep update runs zero, one
 * or several times within that frame. Polling naively makes a jump fire on
 * every step of a slow frame, or vanish entirely on a fast one. Edges are
 * latched when the frame observes them and handed to exactly one step; an edge
 * seen during a frame that ran no steps is carried, not dropped.
 */
export class Input {
	readonly #device: InputDevice;
	readonly #deadzone: number;

	#down = new Set<Action>();

	readonly #pendingPressed = new Set<Action>();
	readonly #pendingReleased = new Set<Action>();

	#stepPressed = new Set<Action>();
	#stepReleased = new Set<Action>();

	readonly #registered = new Set<Action>();

	constructor({ device = raylibDevice, deadzone = DEFAULT_DEADZONE }: InputOptions = {}) {
		this.#device = device;
		this.#deadzone = deadzone;
	}

	/**
	 * Actions register on first use so nothing needs wiring up. A registration
	 * seeds the current state on both sides, so an action first touched while
	 * its key is already held does not report a press that never happened.
	 */
	#track(action: Action): void {
		if (this.#registered.has(action)) return;

		this.#registered.add(action);

		if (action.type === 'button' && this.#anyDown(action.bindings)) {
			this.#down.add(action);
		}
	}

	/** @internal Called once per rendered frame, before any fixed step. */
	beginFrame(): void {
		const nowDown = new Set<Action>();

		for (const action of this.#registered) {
			if (action.type !== 'button') continue;

			if (this.#anyDown(action.bindings)) nowDown.add(action);
		}

		for (const action of nowDown) {
			if (!this.#down.has(action)) this.#pendingPressed.add(action);
		}

		for (const action of this.#down) {
			if (!nowDown.has(action)) this.#pendingReleased.add(action);
		}

		this.#down = nowDown;
	}

	/** @internal Called before each fixed step; hands over the latched edges. */
	beginStep(): void {
		this.#stepPressed = new Set(this.#pendingPressed);
		this.#stepReleased = new Set(this.#pendingReleased);

		this.#pendingPressed.clear();
		this.#pendingReleased.clear();
	}

	/** True on exactly one fixed step per physical press. */
	pressed(action: ButtonAction): boolean {
		this.#track(action);
		return this.#stepPressed.has(action);
	}

	released(action: ButtonAction): boolean {
		this.#track(action);
		return this.#stepReleased.has(action);
	}

	held(action: ButtonAction): boolean {
		this.#track(action);
		return this.#anyDown(action.bindings);
	}

	/** Digital keys win when pressed; the stick fills in otherwise. */
	axis(action: Axis2Action): Vector2 {
		this.#track(action);

		let x = 0;
		let y = 0;

		if (this.#anyDown(action.right)) x += 1;
		if (this.#anyDown(action.left)) x -= 1;
		if (this.#anyDown(action.down)) y += 1;
		if (this.#anyDown(action.up)) y -= 1;

		if (x !== 0 || y !== 0) {
			const length = Math.hypot(x, y);
			return { x: x / length, y: y / length };
		}

		if (!action.stick) return { x: 0, y: 0 };

		const stickX = this.#device.padAxis(action.stick.gamepad, action.stick.axisX);
		const stickY = this.#device.padAxis(action.stick.gamepad, action.stick.axisY);
		const magnitude = Math.hypot(stickX, stickY);

		if (magnitude < this.#deadzone) return { x: 0, y: 0 };

		// Rescale past the deadzone so the stick still reaches zero and one.
		const scaled = (magnitude - this.#deadzone) / (1 - this.#deadzone);
		const clamped = Math.min(scaled, 1);

		return { x: (stickX / magnitude) * clamped, y: (stickY / magnitude) * clamped };
	}

	get mouse(): Vector2 {
		return this.#device.mousePosition();
	}

	get wheel(): number {
		return this.#device.wheel();
	}

	#anyDown(bindings: readonly Binding[]): boolean {
		for (const binding of bindings) {
			switch (binding.device) {
				case 'key':
					if (this.#device.isKeyDown(binding.code)) return true;
					break;
				case 'mouse':
					if (this.#device.isMouseDown(binding.code)) return true;
					break;
				case 'pad':
					if (this.#device.isPadButtonDown(binding.gamepad, binding.code)) return true;
					break;
			}
		}

		return false;
	}
}

export const input = new Input();
