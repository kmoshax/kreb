import * as rl from '@kreb/raylib-sys/raylib';

/**
 * Injected so the latching rules can be tested without a window, which matters
 * because the interesting cases are about step timing, not about raylib.
 */
export interface InputDevice {
	isKeyDown(code: number): boolean;
	isMouseDown(code: number): boolean;
	isPadButtonDown(gamepad: number, code: number): boolean;
	padAxis(gamepad: number, axis: number): number;
	mousePosition(): { x: number; y: number };
	wheel(): number;
}

export const raylibDevice: InputDevice = {
	isKeyDown: (code) => rl.IsKeyDown(code),
	isMouseDown: (code) => rl.IsMouseButtonDown(code),
	isPadButtonDown: (gamepad, code) =>
		rl.IsGamepadAvailable(gamepad) && rl.IsGamepadButtonDown(gamepad, code),
	padAxis: (gamepad, axis) =>
		rl.IsGamepadAvailable(gamepad) ? rl.GetGamepadAxisMovement(gamepad, axis) : 0,
	mousePosition: () => {
		const position = rl.GetMousePosition();
		return { x: position[0] as number, y: position[1] as number };
	},
	wheel: () => rl.GetMouseWheelMove(),
};
