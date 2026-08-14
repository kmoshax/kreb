import { NodeUI, type Rect } from '../core/node-ui.ts';
import type { UiInput } from './input.ts';
import { defaultTheme, type Theme } from './theme.ts';

export type WidgetState = {
	hovered: boolean;
	/** Pointer went down on this widget and has not been released. */
	pressed: boolean;
	focused: boolean;
};

export abstract class Widget extends NodeUI {
	disabled = false;
	theme: Theme = defaultTheme;

	readonly state: WidgetState = { hovered: false, pressed: false, focused: false };

	/** Only focusable widgets take part in keyboard navigation. */
	get focusable(): boolean {
		return !this.disabled;
	}

	/** True when the pointer is over the widget's resolved rect. */
	contains(point: { x: number; y: number }, rect: Rect): boolean {
		return (
			point.x >= rect.x &&
			point.x <= rect.x + rect.width &&
			point.y >= rect.y &&
			point.y <= rect.y + rect.height
		);
	}

	/** Called on the focused widget before pointer handling. */
	handleKeys(_input: UiInput): void {}

	/** Called when a click completes over the widget. */
	activate(): void {}

	onFocus(): void {}

	onBlur(): void {}
}

export function isWidget(value: unknown): value is Widget {
	return value instanceof Widget;
}
