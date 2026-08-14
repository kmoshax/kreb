import { GamepadButton, KeyboardKey, MouseButton } from '@kreb/raylib-sys/enums';
import * as rl from '@kreb/raylib-sys/raylib';
import type { UiInput } from './input.ts';

/**
 * Read straight from raylib rather than through Input actions: UI navigation is
 * fixed by convention, not rebindable, and typed characters have no action to
 * bind to. GetCharPressed drains a queue, so this must run exactly once a step.
 */
export function readUiInput(): UiInput {
	let typed = '';

	for (let code = rl.GetCharPressed(); code > 0; code = rl.GetCharPressed()) {
		typed += String.fromCodePoint(code);
	}

	const shift =
		rl.IsKeyDown(KeyboardKey.KEY_LEFT_SHIFT) || rl.IsKeyDown(KeyboardKey.KEY_RIGHT_SHIFT);
	const tab = rl.IsKeyPressed(KeyboardKey.KEY_TAB);
	const position = rl.GetMousePosition();

	return {
		pointer: { x: position[0] as number, y: position[1] as number },
		pointerDown: rl.IsMouseButtonDown(MouseButton.MOUSE_BUTTON_LEFT),
		pointerPressed: rl.IsMouseButtonPressed(MouseButton.MOUSE_BUTTON_LEFT),
		pointerReleased: rl.IsMouseButtonReleased(MouseButton.MOUSE_BUTTON_LEFT),
		focusNext: tab && !shift,
		focusPrevious: tab && shift,
		activate:
			rl.IsKeyPressed(KeyboardKey.KEY_ENTER) ||
			rl.IsKeyPressed(KeyboardKey.KEY_SPACE) ||
			rl.IsGamepadButtonPressed(0, GamepadButton.GAMEPAD_BUTTON_RIGHT_FACE_DOWN),
		left: rl.IsKeyPressed(KeyboardKey.KEY_LEFT),
		right: rl.IsKeyPressed(KeyboardKey.KEY_RIGHT),
		backspace: rl.IsKeyPressed(KeyboardKey.KEY_BACKSPACE),
		typed,
	};
}
