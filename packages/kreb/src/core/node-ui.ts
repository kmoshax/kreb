import type { DrawUI } from '../draw/context.ts';
import { Node, RenderSpace } from './node.ts';

export type Rect = { x: number; y: number; width: number; height: number };

/** Fraction of the parent rect each edge is pinned to. */
export const Anchor = {
	TopLeft: { x: 0, y: 0 },
	TopCenter: { x: 0.5, y: 0 },
	TopRight: { x: 1, y: 0 },
	Center: { x: 0.5, y: 0.5 },
	BottomLeft: { x: 0, y: 1 },
	BottomCenter: { x: 0.5, y: 1 },
	BottomRight: { x: 1, y: 1 },
} as const;

export type Anchor = { x: number; y: number };

export class NodeUI extends Node {
	anchor: Anchor = Anchor.TopLeft;
	offset: Rect = { x: 0, y: 0, width: 0, height: 0 };
	zIndex = 0;

	override get space(): RenderSpace | null {
		return RenderSpace.Ui;
	}

	/**
	 * Screen-space rect. UI is resolved against the viewport each frame rather
	 * than cached, because a window resize invalidates every node at once and a
	 * dirty flag would have to be broadcast to all of them anyway.
	 */
	resolve(viewport: Rect): Rect {
		const parent = this.#parentUI();
		const base = parent ? parent.resolve(viewport) : viewport;

		return {
			x: base.x + base.width * this.anchor.x + this.offset.x,
			y: base.y + base.height * this.anchor.y + this.offset.y,
			width: this.offset.width,
			height: this.offset.height,
		};
	}

	draw(_g: DrawUI): void {}

	#parentUI(): NodeUI | null {
		for (let node = this.parent; node; node = node.parent) {
			if (node instanceof NodeUI) return node;
		}

		return null;
	}
}
