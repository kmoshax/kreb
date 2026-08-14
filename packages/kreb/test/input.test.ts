import { expect, test } from 'bun:test';
import { actions, axis2, mouse, pad, stick } from '../src/input/bindings.ts';
import type { InputDevice } from '../src/input/device.ts';
import { Input } from '../src/input/input.ts';

const KEY_SPACE = 32;
const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
const PAD_A = 7;
const MOUSE_LEFT = 0;

function fakeDevice() {
	const keys = new Set<number>();
	const buttons = new Set<number>();
	const mouseButtons = new Set<number>();
	const axes = new Map<number, number>();

	const device: InputDevice = {
		isKeyDown: (code) => keys.has(code),
		isMouseDown: (code) => mouseButtons.has(code),
		isPadButtonDown: (_gamepad, code) => buttons.has(code),
		padAxis: (_gamepad, axis) => axes.get(axis) ?? 0,
		mousePosition: () => ({ x: 0, y: 0 }),
		wheel: () => 0,
	};

	return { device, keys, buttons, mouseButtons, axes };
}

const Act = actions({
	jump: [KEY_SPACE, pad(PAD_A)],
	fire: mouse(MOUSE_LEFT),
	move: axis2({ up: KEY_W, down: KEY_S, left: KEY_A, right: KEY_D }, stick(0, 1)),
});

/** One rendered frame that runs `steps` fixed updates, collecting what each saw. */
function frame(input: Input, steps: number): boolean[] {
	input.beginFrame();

	const seen: boolean[] = [];
	for (let i = 0; i < steps; i += 1) {
		input.beginStep();
		seen.push(input.pressed(Act.jump));
	}

	return seen;
}

test('a press is delivered to exactly one step', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	frame(input, 1);

	keys.add(KEY_SPACE);
	expect(frame(input, 1)).toEqual([true]);

	// Still held, but the edge already fired.
	expect(frame(input, 1)).toEqual([false]);
});

test('at 30fps a press fires once, not once per step', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	frame(input, 1);
	keys.add(KEY_SPACE);

	// A 1/30s frame at a 60Hz step runs two updates.
	expect(frame(input, 2)).toEqual([true, false]);
});

test('a press during a frame that runs no steps is carried, not dropped', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	frame(input, 1);

	keys.add(KEY_SPACE);
	expect(frame(input, 0)).toEqual([]);

	// Next frame the key is still down, so there is no new edge to observe;
	// the carried one must survive.
	expect(frame(input, 1)).toEqual([true]);
});

test('a tap entirely inside a stepless frame still reaches a step', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	frame(input, 1);

	keys.add(KEY_SPACE);
	frame(input, 0);

	keys.delete(KEY_SPACE);
	frame(input, 0);

	input.beginFrame();
	input.beginStep();

	expect(input.pressed(Act.jump)).toBe(true);
	expect(input.released(Act.jump)).toBe(true);
	expect(input.held(Act.jump)).toBe(false);
});

test('pressed is stable within a step and clears on the next', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	frame(input, 1);
	keys.add(KEY_SPACE);

	input.beginFrame();
	input.beginStep();

	expect(input.pressed(Act.jump)).toBe(true);
	expect(input.pressed(Act.jump)).toBe(true);

	input.beginStep();
	expect(input.pressed(Act.jump)).toBe(false);
});

test('release is an edge too', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	keys.add(KEY_SPACE);
	frame(input, 1);

	keys.delete(KEY_SPACE);
	input.beginFrame();
	input.beginStep();

	expect(input.released(Act.jump)).toBe(true);
	expect(input.held(Act.jump)).toBe(false);
});

test('an action already held when first used does not report a phantom press', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	keys.add(KEY_SPACE);

	input.beginFrame();
	input.beginStep();

	expect(input.held(Act.jump)).toBe(true);
	expect(input.pressed(Act.jump)).toBe(false);
});

test('any bound device satisfies the action', () => {
	const { device, keys, buttons, mouseButtons } = fakeDevice();
	const input = new Input({ device });

	expect(input.held(Act.jump)).toBe(false);

	buttons.add(PAD_A);
	expect(input.held(Act.jump)).toBe(true);

	buttons.clear();
	keys.add(KEY_SPACE);
	expect(input.held(Act.jump)).toBe(true);

	mouseButtons.add(MOUSE_LEFT);
	expect(input.held(Act.fire)).toBe(true);
});

test('digital axis is normalized on the diagonal', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	keys.add(KEY_D);
	expect(input.axis(Act.move)).toEqual({ x: 1, y: 0 });

	keys.add(KEY_S);
	const diagonal = input.axis(Act.move);

	expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1, 6);
	expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 6);
});

test('opposing keys cancel', () => {
	const { device, keys } = fakeDevice();
	const input = new Input({ device });

	keys.add(KEY_A);
	keys.add(KEY_D);

	expect(input.axis(Act.move)).toEqual({ x: 0, y: 0 });
});

test('stick input below the deadzone reads as zero', () => {
	const { device, axes } = fakeDevice();
	const input = new Input({ device, deadzone: 0.25 });

	axes.set(0, 0.1);
	expect(input.axis(Act.move)).toEqual({ x: 0, y: 0 });
});

test('stick input is rescaled so it still reaches zero and one', () => {
	const { device, axes } = fakeDevice();
	const input = new Input({ device, deadzone: 0.25 });

	axes.set(0, 0.25001);
	expect(input.axis(Act.move).x).toBeCloseTo(0, 3);

	axes.set(0, 1);
	expect(input.axis(Act.move).x).toBeCloseTo(1, 6);
});

test('keys take priority over a resting stick', () => {
	const { device, keys, axes } = fakeDevice();
	const input = new Input({ device });

	axes.set(0, 0.9);
	keys.add(KEY_A);

	expect(input.axis(Act.move).x).toBe(-1);
});

test('actions carry their declared name and bindings', () => {
	expect(Act.jump.type).toBe('button');
	expect(Act.jump.name).toBe('jump');
	expect(Act.jump.bindings).toEqual([
		{ device: 'key', code: KEY_SPACE },
		{ device: 'pad', code: PAD_A, gamepad: 0 },
	]);

	expect(Act.move.type).toBe('axis2');
	expect(Act.move.stick).toEqual({ axisX: 0, axisY: 1, gamepad: 0 });
});
