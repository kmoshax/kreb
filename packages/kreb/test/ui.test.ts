import { expect, test } from 'bun:test';
import { Anchor, type Rect } from 'kreb/core/node-ui';
import { emptyUiInput, type UiInput } from 'kreb/ui/input';
import { UiSystem } from 'kreb/ui/system';
import { Button, Checkbox, Label, Panel, Slider, TextInput } from 'kreb/ui/widgets';

const VIEWPORT: Rect = { x: 0, y: 0, width: 800, height: 600 };

function place<T extends { offset: Rect; anchor: Anchor }>(
	widget: T,
	x: number,
	y: number,
	width: number,
	height: number,
): T {
	widget.anchor = Anchor.TopLeft;
	widget.offset = { x, y, width, height };

	return widget;
}

function at(x: number, y: number): Partial<UiInput> {
	return { pointer: { x, y } };
}

function step(ui: UiSystem, root: Panel, overrides: Partial<UiInput> = {}): void {
	ui.collect(root);
	ui.step(VIEWPORT, { ...emptyUiInput(), ...overrides });
}

/** Press and release over the same point, the way a real click arrives. */
function click(ui: UiSystem, root: Panel, x: number, y: number): void {
	step(ui, root, { ...at(x, y), pointerPressed: true, pointerDown: true });
	step(ui, root, { ...at(x, y), pointerReleased: true });
}

function scene() {
	const root = place(new Panel('root'), 0, 0, 800, 600);
	return { root, ui: new UiSystem() };
}

test('widgets are collected from the tree', () => {
	const { root, ui } = scene();
	root.add(place(new Button('ok'), 0, 0, 100, 30));
	root.add(place(new Label('hi'), 0, 40, 100, 30));

	ui.collect(root);
	expect(ui.size).toBe(3);
});

test('hover follows the pointer and ignores disabled widgets', () => {
	const { root, ui } = scene();
	const button = root.add(place(new Button('ok'), 10, 10, 100, 30));

	step(ui, root, at(50, 20));
	expect(button.state.hovered).toBe(true);

	step(ui, root, at(500, 500));
	expect(button.state.hovered).toBe(false);

	button.disabled = true;
	step(ui, root, at(50, 20));
	expect(button.state.hovered).toBe(false);
});

test('a click fires onPress exactly once', () => {
	const { root, ui } = scene();

	let presses = 0;
	const button = root.add(
		place(
			new Button('ok', () => {
				presses += 1;
			}),
			10,
			10,
			100,
			30,
		),
	);

	click(ui, root, 50, 20);
	expect(presses).toBe(1);
	expect(button.state.pressed).toBe(false);
});

test('a click that drifts off the widget does not fire', () => {
	const { root, ui } = scene();

	let presses = 0;
	root.add(
		place(
			new Button('ok', () => {
				presses += 1;
			}),
			10,
			10,
			100,
			30,
		),
	);

	step(ui, root, { ...at(50, 20), pointerPressed: true, pointerDown: true });
	step(ui, root, { ...at(600, 500), pointerReleased: true });

	expect(presses).toBe(0);
});

test('a disabled button never activates', () => {
	const { root, ui } = scene();

	let presses = 0;
	const button = root.add(
		place(
			new Button('ok', () => {
				presses += 1;
			}),
			10,
			10,
			100,
			30,
		),
	);
	button.disabled = true;

	click(ui, root, 50, 20);
	expect(presses).toBe(0);
});

test('clicking focuses, and clicking empty space clears focus', () => {
	const { root, ui } = scene();
	const button = root.add(place(new Button('ok'), 10, 10, 100, 30));

	click(ui, root, 50, 20);
	expect(ui.focused).toBe(button);

	// The root panel is not focusable, so a click on it drops focus.
	click(ui, root, 700, 500);
	expect(ui.focused).toBeNull();
});

test('tab cycles focusable widgets in declaration order and wraps', () => {
	const { root, ui } = scene();
	const first = root.add(place(new Button('a'), 0, 0, 80, 24));
	root.add(place(new Label('not focusable'), 0, 30, 80, 24));
	const second = root.add(place(new Checkbox('b'), 0, 60, 80, 24));

	step(ui, root, { focusNext: true });
	expect(ui.focused).toBe(first);

	step(ui, root, { focusNext: true });
	expect(ui.focused).toBe(second);

	step(ui, root, { focusNext: true });
	expect(ui.focused).toBe(first);

	step(ui, root, { focusPrevious: true });
	expect(ui.focused).toBe(second);
});

test('a focused button activates from the keyboard', () => {
	const { root, ui } = scene();

	let presses = 0;
	root.add(
		place(
			new Button('ok', () => {
				presses += 1;
			}),
			0,
			0,
			80,
			24,
		),
	);

	step(ui, root, { focusNext: true });
	step(ui, root, { activate: true });

	expect(presses).toBe(1);
});

test('focus is dropped when the widget leaves the tree', () => {
	const { root, ui } = scene();
	const button = root.add(place(new Button('ok'), 0, 0, 80, 24));

	step(ui, root, { focusNext: true });
	expect(ui.focused).toBe(button);

	button.destroy();
	ui.collect(root);

	expect(ui.focused).toBeNull();
});

test('focus is dropped when the widget becomes disabled', () => {
	const { root, ui } = scene();
	const button = root.add(place(new Button('ok'), 0, 0, 80, 24));

	step(ui, root, { focusNext: true });
	button.disabled = true;
	ui.collect(root);

	expect(ui.focused).toBeNull();
});

test('a checkbox toggles and reports the new value', () => {
	const { root, ui } = scene();
	const box = root.add(place(new Checkbox('sound', false), 10, 10, 160, 24));

	const seen: boolean[] = [];
	box.onChange = (checked) => seen.push(checked);

	click(ui, root, 20, 20);
	expect(box.checked).toBe(true);

	click(ui, root, 20, 20);
	expect(box.checked).toBe(false);
	expect(seen).toEqual([true, false]);
});

test('a slider clamps to its range and reports changes', () => {
	const slider = new Slider(0.5, 0, 1);

	const seen: number[] = [];
	slider.onChange = (value) => seen.push(value);

	slider.value = 2;
	expect(slider.value).toBe(1);

	slider.value = -5;
	expect(slider.value).toBe(0);
	expect(seen).toEqual([1, 0]);

	// Setting the same value again is not a change.
	slider.value = 0;
	expect(seen).toEqual([1, 0]);
});

test('a slider refuses an inverted range', () => {
	expect(() => new Slider(0, 1, 1)).toThrow('must exceed');
});

test('dragging a slider tracks the pointer, even past its edge', () => {
	const { root, ui } = scene();
	const slider = root.add(place(new Slider(0, 0, 100), 100, 10, 200, 24));

	step(ui, root, { ...at(200, 20), pointerPressed: true, pointerDown: true });
	expect(slider.value).toBeGreaterThan(40);
	expect(slider.value).toBeLessThan(60);

	// Dragging beyond the track still belongs to the pressed widget.
	step(ui, root, { ...at(900, 20), pointerDown: true });
	expect(slider.value).toBe(100);
});

test('arrow keys nudge a focused slider', () => {
	const { root, ui } = scene();
	const slider = root.add(place(new Slider(0.5, 0, 1), 0, 0, 200, 24));

	step(ui, root, { focusNext: true });
	step(ui, root, { right: true });
	expect(slider.value).toBeCloseTo(0.55, 6);

	step(ui, root, { left: true });
	step(ui, root, { left: true });
	expect(slider.value).toBeCloseTo(0.45, 6);
});

test('a focused text input receives characters and backspace', () => {
	const { root, ui } = scene();
	const field = root.add(place(new TextInput('', 'field'), 0, 0, 200, 28));

	step(ui, root, { focusNext: true });
	step(ui, root, { typed: 'kre' });
	step(ui, root, { typed: 'b' });

	expect(field.value).toBe('kreb');

	step(ui, root, { backspace: true });
	expect(field.value).toBe('kre');
});

test('an unfocused text input ignores typing', () => {
	const { root, ui } = scene();
	const field = root.add(place(new TextInput('', 'field'), 0, 0, 200, 28));

	step(ui, root, { typed: 'nope' });
	expect(field.value).toBe('');
});

test('a text input respects maxLength and submits', () => {
	const { root, ui } = scene();
	const field = root.add(place(new TextInput('', 'field'), 0, 0, 200, 28));
	field.maxLength = 3;

	const submitted: string[] = [];
	field.onSubmit = (value) => submitted.push(value);

	step(ui, root, { focusNext: true });
	step(ui, root, { typed: 'abcdef' });
	expect(field.value).toBe('abc');

	step(ui, root, { activate: true });
	expect(submitted).toEqual(['abc']);
});

test('the topmost widget by zIndex wins the pointer', () => {
	const { root, ui } = scene();

	let back = 0;
	let front = 0;

	const under = root.add(
		place(
			new Button('under', () => {
				back += 1;
			}),
			0,
			0,
			200,
			200,
		),
	);
	const over = root.add(
		place(
			new Button('over', () => {
				front += 1;
			}),
			0,
			0,
			100,
			100,
		),
	);

	under.zIndex = 0;
	over.zIndex = 10;

	click(ui, root, 50, 50);

	expect(front).toBe(1);
	expect(back).toBe(0);
});

test('nested widgets resolve against their parent rect', () => {
	const { root, ui } = scene();
	const panel = root.add(place(new Panel('panel'), 100, 100, 300, 200));

	let presses = 0;
	const button = panel.add(
		place(
			new Button('inner', () => {
				presses += 1;
			}),
			20,
			20,
			100,
			30,
		),
	);

	const rect = button.resolve(VIEWPORT);
	expect(rect.x).toBe(120);
	expect(rect.y).toBe(120);

	click(ui, root, 130, 130);
	expect(presses).toBe(1);
});
