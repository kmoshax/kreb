import type { DrawUI } from '../draw/context.ts';
import type { UiInput } from './input.ts';
import { measureText } from './measure.ts';
import { Widget } from './widget.ts';

const CHECKBOX_SIZE = 20;
const SLIDER_TRACK_HEIGHT = 6;
const SLIDER_KNOB_WIDTH = 12;
const CARET_BLINK_STEPS = 30;

export class Panel extends Widget {
	override get focusable(): boolean {
		return false;
	}

	override draw(g: DrawUI): void {
		const { width, height } = g;
		const { roundness } = this.theme;

		g.roundedRect(4, 6, width, height, { roundness, color: this.theme.shadow });
		g.roundedRect(0, 0, width, height, { roundness, color: this.theme.panel });
		g.roundedOutline(0, 0, width, height, { roundness, color: this.theme.panelBorder });
	}
}

export class Label extends Widget {
	text: string;
	muted = false;

	constructor(text: string, name?: string) {
		super(name);
		this.text = text;
	}

	override get focusable(): boolean {
		return false;
	}

	protected override intrinsicSize() {
		return { width: measureText(this.text, this.theme.fontSize), height: this.theme.fontSize };
	}

	override draw(g: DrawUI): void {
		g.text(this.text, 0, 0, {
			size: this.theme.fontSize,
			color: this.muted ? this.theme.textMuted : this.theme.text,
		});
	}
}

export class Button extends Widget {
	text: string;
	onPress: () => void = () => {};

	constructor(text: string, onPress?: () => void, name?: string) {
		super(name);

		this.text = text;
		if (onPress) this.onPress = onPress;
	}

	protected override intrinsicSize() {
		const padding = this.theme.padding;

		return {
			width: measureText(this.text, this.theme.fontSize) + padding * 3,
			height: this.theme.fontSize + padding * 2,
		};
	}

	override activate(): void {
		if (this.disabled) return;

		this.onPress();
	}

	override handleKeys(input: UiInput): void {
		if (input.activate) this.activate();
	}

	override draw(g: DrawUI): void {
		const { width, height } = g;
		const background = this.disabled
			? this.theme.control
			: this.state.pressed
				? this.theme.controlActive
				: this.state.hovered
					? this.theme.controlHover
					: this.theme.control;

		const roundness = this.theme.roundness;
		const sink = this.state.pressed ? 1 : 0;

		if (!this.disabled) g.roundedRect(0, 3, width, height, { roundness, color: this.theme.shadow });

		g.roundedRect(0, sink, width, height, { roundness, color: background });

		if (this.state.focused) {
			g.roundedOutline(0, sink, width, height, {
				roundness,
				thickness: 2,
				color: this.theme.focusRing,
			});
		}

		const size = this.theme.fontSize;
		const textWidth = g.measure(this.text, size);

		g.text(this.text, (width - textWidth) / 2, (height - size) / 2 + sink, {
			size,
			color: this.disabled ? this.theme.textMuted : this.theme.text,
		});
	}
}

export class Checkbox extends Widget {
	text: string;
	checked = false;
	onChange: (checked: boolean) => void = () => {};

	constructor(text: string, checked = false, name?: string) {
		super(name);

		this.text = text;
		this.checked = checked;
	}

	protected override intrinsicSize() {
		return {
			width: CHECKBOX_SIZE + this.theme.padding + measureText(this.text, this.theme.fontSize),
			height: Math.max(CHECKBOX_SIZE, this.theme.fontSize),
		};
	}

	override activate(): void {
		if (this.disabled) return;

		this.checked = !this.checked;
		this.onChange(this.checked);
	}

	override handleKeys(input: UiInput): void {
		if (input.activate) this.activate();
	}

	override draw(g: DrawUI): void {
		const { height } = g;
		const top = (height - CHECKBOX_SIZE) / 2;
		const border = this.state.focused ? this.theme.focusRing : this.theme.panelBorder;

		const box = { roundness: 0.3 };

		g.roundedRect(0, top, CHECKBOX_SIZE, CHECKBOX_SIZE, {
			...box,
			color: this.checked
				? this.theme.accent
				: this.state.hovered
					? this.theme.controlHover
					: this.theme.control,
		});
		g.roundedOutline(0, top, CHECKBOX_SIZE, CHECKBOX_SIZE, { ...box, color: border });

		if (this.checked) {
			// A tick built from two strokes reads better than a filled square.
			g.rect(5, top + 10, 4, 4, { color: this.theme.panel });
			g.rect(8, top + 12, 3, 3, { color: this.theme.panel });
			g.rect(10, top + 6, 5, 7, { color: this.theme.panel });
		}

		g.text(this.text, CHECKBOX_SIZE + this.theme.padding, (height - this.theme.fontSize) / 2, {
			size: this.theme.fontSize,
			color: this.disabled ? this.theme.textMuted : this.theme.text,
		});
	}
}

export class Slider extends Widget {
	min: number;
	max: number;
	step: number;
	onChange: (value: number) => void = () => {};

	#value: number;

	constructor(value = 0, min = 0, max = 1, name?: string) {
		super(name);

		if (max <= min) throw new Error(`Slider max (${max}) must exceed min (${min})`);

		this.min = min;
		this.max = max;
		this.step = (max - min) / 20;
		this.#value = this.clamp(value);
	}

	get value(): number {
		return this.#value;
	}

	set value(next: number) {
		const clamped = this.clamp(next);
		if (clamped === this.#value) return;

		this.#value = clamped;
		this.onChange(clamped);
	}

	get fraction(): number {
		return (this.#value - this.min) / (this.max - this.min);
	}

	/** Drives the value from a pointer x within the widget's own rect. */
	dragTo(localX: number): void {
		const usable = Math.max(this.offset.width - SLIDER_KNOB_WIDTH, 1);
		const fraction = Math.min(Math.max((localX - SLIDER_KNOB_WIDTH / 2) / usable, 0), 1);

		this.value = this.min + fraction * (this.max - this.min);
	}

	override handleKeys(input: UiInput): void {
		if (input.left) this.value = this.#value - this.step;
		if (input.right) this.value = this.#value + this.step;
	}

	private clamp(value: number): number {
		return Math.min(Math.max(value, this.min), this.max);
	}

	override draw(g: DrawUI): void {
		const { width, height } = g;
		const trackTop = (height - SLIDER_TRACK_HEIGHT) / 2;

		const track = { roundness: 1 };

		g.roundedRect(0, trackTop, width, SLIDER_TRACK_HEIGHT, { ...track, color: this.theme.control });
		g.roundedRect(0, trackTop, width * this.fraction, SLIDER_TRACK_HEIGHT, {
			...track,
			color: this.theme.accent,
		});

		const knobX = (width - SLIDER_KNOB_WIDTH) * this.fraction;

		if (this.state.hovered || this.state.focused) {
			g.roundedRect(knobX - 4, -2, SLIDER_KNOB_WIDTH + 8, height + 4, {
				roundness: 1,
				color: this.theme.accentMuted,
			});
		}

		g.roundedRect(knobX, 0, SLIDER_KNOB_WIDTH, height, {
			roundness: 1,
			color: this.state.focused ? this.theme.focusRing : this.theme.text,
		});
	}
}

export class TextInput extends Widget {
	placeholder = '';
	maxLength = 128;
	onChange: (value: string) => void = () => {};
	onSubmit: (value: string) => void = () => {};

	#value: string;
	#blink = 0;

	constructor(value = '', name?: string) {
		super(name);
		this.#value = value;
	}

	get value(): string {
		return this.#value;
	}

	set value(next: string) {
		const clipped = next.slice(0, this.maxLength);
		if (clipped === this.#value) return;

		this.#value = clipped;
		this.onChange(clipped);
	}

	override handleKeys(input: UiInput): void {
		if (this.disabled) return;

		if (input.backspace && this.#value.length > 0) {
			this.value = this.#value.slice(0, -1);
		}

		if (input.typed) this.value = this.#value + input.typed;
		if (input.activate) this.onSubmit(this.#value);
	}

	override update(): void {
		this.#blink = (this.#blink + 1) % (CARET_BLINK_STEPS * 2);
	}

	override draw(g: DrawUI): void {
		const { width, height } = g;
		const border = this.state.focused ? this.theme.focusRing : this.theme.panelBorder;

		const roundness = this.theme.roundness;

		g.roundedRect(0, 0, width, height, { roundness, color: this.theme.control });
		g.roundedOutline(0, 0, width, height, {
			roundness,
			thickness: this.state.focused ? 2 : 1,
			color: border,
		});

		const size = this.theme.fontSize;
		const top = (height - size) / 2;
		const showing = this.#value || this.placeholder;

		g.text(showing, this.theme.padding, top, {
			size,
			color: this.#value ? this.theme.text : this.theme.textMuted,
		});

		if (this.state.focused && this.#blink < CARET_BLINK_STEPS) {
			const caretX = this.theme.padding + g.measure(this.#value, size) + 1;
			g.rect(caretX, top, 2, size, { color: this.theme.text });
		}
	}
}
