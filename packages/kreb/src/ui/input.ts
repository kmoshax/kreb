import type { Vector2 } from '@kreb/math';

/**
 * A flat snapshot rather than the Input class, so widget behaviour can be
 * driven from tests without a window or a device.
 */
export type UiInput = {
	pointer: Vector2;
	pointerDown: boolean;
	pointerPressed: boolean;
	pointerReleased: boolean;
	focusNext: boolean;
	focusPrevious: boolean;
	activate: boolean;
	left: boolean;
	right: boolean;
	backspace: boolean;
	/** Characters typed since the previous step. */
	typed: string;
};

export function emptyUiInput(): UiInput {
	return {
		pointer: { x: 0, y: 0 },
		pointerDown: false,
		pointerPressed: false,
		pointerReleased: false,
		focusNext: false,
		focusPrevious: false,
		activate: false,
		left: false,
		right: false,
		backspace: false,
		typed: '',
	};
}
