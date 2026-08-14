import type { Node } from '../core/node.ts';
import type { Rect } from '../core/node-ui.ts';
import type { UiInput } from './input.ts';
import { isWidget, type Widget } from './widget.ts';

/**
 * Hit testing, focus and dispatch for widgets, collected from the tree the same
 * way drawables and colliders are.
 */
export class UiSystem {
	readonly #widgets: Widget[] = [];

	#focused: Widget | null = null;
	#pressedOn: Widget | null = null;

	get focused(): Widget | null {
		return this.#focused;
	}

	get size(): number {
		return this.#widgets.length;
	}

	collect(root: Node): void {
		this.#widgets.length = 0;
		this.#walk(root);

		// A widget that left the tree or was disabled must not keep focus.
		if (this.#focused && !this.#widgets.includes(this.#focused)) this.focus(null);
		else if (this.#focused && !this.#focused.focusable) this.focus(null);
	}

	focus(widget: Widget | null): void {
		if (widget === this.#focused) return;

		this.#focused?.onBlur();
		if (this.#focused) this.#focused.state.focused = false;

		this.#focused = widget;

		if (widget) {
			widget.state.focused = true;
			widget.onFocus();
		}
	}

	step(viewport: Rect, input: UiInput): void {
		const rects = new Map<Widget, Rect>();
		for (const widget of this.#widgets) rects.set(widget, widget.resolve(viewport));

		this.#updateHover(rects, input);
		this.#handlePointer(rects, input);
		this.#handleFocusMove(input);

		if (this.#focused && !this.#focused.disabled) this.#focused.handleKeys(input);
	}

	/** Tree order, then zIndex, so Tab follows the order things are declared. */
	#focusOrder(): Widget[] {
		return this.#widgets
			.map((widget, index) => ({ widget, index }))
			.filter(({ widget }) => widget.focusable)
			.sort((a, b) => a.widget.zIndex - b.widget.zIndex || a.index - b.index)
			.map(({ widget }) => widget);
	}

	#updateHover(rects: Map<Widget, Rect>, input: UiInput): void {
		const top = this.#topmostAt(rects, input.pointer);

		for (const widget of this.#widgets) {
			widget.state.hovered = widget === top && !widget.disabled;
		}
	}

	/** Later siblings and higher zIndex win, matching the draw order. */
	#topmostAt(rects: Map<Widget, Rect>, point: { x: number; y: number }): Widget | null {
		let best: Widget | null = null;
		let bestZ = Number.NEGATIVE_INFINITY;

		for (const widget of this.#widgets) {
			if (widget.disabled) continue;

			const rect = rects.get(widget);
			if (!rect || !widget.contains(point, rect)) continue;

			if (widget.zIndex >= bestZ) {
				best = widget;
				bestZ = widget.zIndex;
			}
		}

		return best;
	}

	#handlePointer(rects: Map<Widget, Rect>, input: UiInput): void {
		const hit = this.#topmostAt(rects, input.pointer);

		if (input.pointerPressed) {
			this.#pressedOn = hit;
			this.focus(hit?.focusable ? hit : null);

			if (hit) hit.state.pressed = true;
		}

		if (input.pointerDown && this.#pressedOn) {
			// Dragging is delivered to whatever was pressed, even off its rect.
			const rect = rects.get(this.#pressedOn);
			if (rect) this.#drag(this.#pressedOn, rect, input);
		}

		if (input.pointerReleased) {
			const pressed = this.#pressedOn;
			this.#pressedOn = null;

			for (const widget of this.#widgets) widget.state.pressed = false;

			// A click only counts if it began and ended on the same widget.
			if (pressed && pressed === hit && !pressed.disabled) pressed.activate();
		}
	}

	#drag(widget: Widget, rect: Rect, input: UiInput): void {
		if (!('dragTo' in widget) || typeof widget.dragTo !== 'function') return;

		(widget.dragTo as (localX: number) => void)(input.pointer.x - rect.x);
	}

	#handleFocusMove(input: UiInput): void {
		if (!input.focusNext && !input.focusPrevious) return;

		const order = this.#focusOrder();
		if (order.length === 0) return;

		const current = this.#focused ? order.indexOf(this.#focused) : -1;
		const delta = input.focusPrevious ? -1 : 1;
		const next = (current + delta + order.length) % order.length;

		this.focus(order[next] ?? null);
	}

	#walk(node: Node): void {
		// Hidden UI must not take clicks either, or a menu behind an overlay
		// would still be reachable by the pointer.
		if (node.destroyed || !node.visible) return;

		if (isWidget(node)) this.#widgets.push(node);

		for (const child of node.children) this.#walk(child);
	}
}
