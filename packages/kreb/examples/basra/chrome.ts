// Shared menu furniture: the backdrop, a title, and a column of buttons.

import { Anchor, Button, type DrawUI, Label, type Node, NodeUI, type Scene } from 'kreb';
import { Palette } from './art.ts';

export const SCREEN = { width: 1100, height: 700 };

const ROW_HEIGHT = 52;

/** Full-bleed felt so every screen shares one background. */
export class Backdrop extends NodeUI {
	constructor(private readonly dim = 0) {
		super('backdrop');
	}

	override draw(g: DrawUI): void {
		g.rect(0, 0, g.width, g.height, { color: Palette.felt });

		if (this.dim > 0) g.rect(0, 0, g.width, g.height, { color: 0x000000aa });
	}
}

export class Title extends NodeUI {
	constructor(
		private readonly heading: string,
		private readonly sub: string,
	) {
		super('title');
	}

	override draw(g: DrawUI): void {
		g.text(this.heading, 0, 0, { size: 54 });
		g.text(this.sub, 2, 62, { size: 18, color: 0x9fb0a8ff });
	}
}

export function backdrop(scene: Scene, dim = 0): void {
	scene.add(new Backdrop(dim)).place({
		anchor: Anchor.TopLeft,
		width: SCREEN.width,
		height: SCREEN.height,
	});
}

export function title(scene: Scene, heading: string, sub: string, x = 96, y = 84): void {
	scene
		.add(new Title(heading, sub))
		.place({ anchor: Anchor.TopLeft, x, y, width: 600, height: 90 });
}

export type MenuEntry = {
	label: string;
	onPress: () => void;
	enabled?: boolean;
};

/**
 * A vertical run of buttons. Returning them lets a caller keep a handle without
 * the scene having to name every row.
 */
export function menuColumn(
	scene: Scene,
	entries: MenuEntry[],
	{ x = 96, y = 220, width = 320 } = {},
): Button[] {
	return entries.map((entry, index) => {
		const button = scene.add(new Button(entry.label, entry.onPress, entry.label));
		button.disabled = entry.enabled === false;

		button.place({
			anchor: Anchor.TopLeft,
			x,
			y: y + index * ROW_HEIGHT,
			width,
			height: 44,
		});

		return button;
	});
}

export function note(scene: Scene, text: string, y: number, x = 96): Label {
	const label = scene.add(new Label(text));
	label.muted = true;
	label.place({ anchor: Anchor.TopLeft, x, y });

	return label;
}

export function hint(scene: Scene, text: string): Label {
	const label = scene.add(new Label(text, 'hint'));
	label.muted = true;
	label.place({ anchor: Anchor.BottomLeft, x: 96, y: -56 });

	return label;
}

/** Depth-first search for a node by name, for scenes that keep few handles. */
export function findByName(root: Node, name: string): Node | null {
	if (root.name === name) return root;

	for (const child of root.children) {
		const found = findByName(child, name);
		if (found) return found;
	}

	return null;
}
