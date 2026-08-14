// Card art drawn from primitives. raylib's default font has no ♠♥♦♣ glyphs, so
// the suits are built from circles, triangles and a rotated square instead of
// shipping a font file.

import type { Draw2D, Vector2 } from 'kreb';
import { type Card, isRed } from './rules.ts';

export const CARD = { width: 78, height: 110 };

export const Palette = {
	felt: 0x14342bff,
	feltEdge: 0x0d241dff,
	face: 0xf7f5efff,
	faceEdge: 0xd9d4c6ff,
	back: 0x2a3b8fff,
	backInk: 0x8fa4ffff,
	red: 0xc0392bff,
	black: 0x22262eff,
	shadow: 0x00000044,
	glow: 0xffd76688,
} as const;

const ROUND = { roundness: 0.14 };

function offset(at: Vector2, dx: number, dy: number): Vector2 {
	return { x: at.x + dx, y: at.y + dy };
}

function heart(g: Draw2D, at: Vector2, size: number, color: number): void {
	const lobe = size * 0.28;

	g.circle(offset(at, -lobe * 0.85, -lobe * 0.45), lobe, { color });
	g.circle(offset(at, lobe * 0.85, -lobe * 0.45), lobe, { color });
	g.triangle(
		offset(at, -size * 0.5, -size * 0.05),
		offset(at, 0, size * 0.55),
		offset(at, size * 0.5, -size * 0.05),
		{ color },
	);
}

function spade(g: Draw2D, at: Vector2, size: number, color: number): void {
	const lobe = size * 0.28;

	g.triangle(
		offset(at, -size * 0.5, size * 0.1),
		offset(at, size * 0.5, size * 0.1),
		offset(at, 0, -size * 0.55),
		{ color },
	);
	g.circle(offset(at, -lobe * 0.85, size * 0.1), lobe, { color });
	g.circle(offset(at, lobe * 0.85, size * 0.1), lobe, { color });
	g.triangle(
		offset(at, -size * 0.22, size * 0.55),
		offset(at, size * 0.22, size * 0.55),
		offset(at, 0, size * 0.18),
		{ color },
	);
}

function club(g: Draw2D, at: Vector2, size: number, color: number): void {
	const lobe = size * 0.26;

	g.circle(offset(at, 0, -size * 0.28), lobe, { color });
	g.circle(offset(at, -size * 0.32, size * 0.1), lobe, { color });
	g.circle(offset(at, size * 0.32, size * 0.1), lobe, { color });
	g.triangle(
		offset(at, -size * 0.22, size * 0.55),
		offset(at, size * 0.22, size * 0.55),
		offset(at, 0, size * 0.1),
		{ color },
	);
}

function diamond(g: Draw2D, at: Vector2, size: number, color: number): void {
	// A square turned 45 degrees is exactly a diamond pip.
	g.polygon(at, 4, size * 0.55, 45, { color });
}

const PIPS: Record<Card['suit'], typeof heart> = {
	hearts: heart,
	diamonds: diamond,
	spades: spade,
	clubs: club,
};

export function drawPip(g: Draw2D, card: Card, at: Vector2, size: number, color: number): void {
	PIPS[card.suit](g, at, size, color);
}

export type CardLook = {
	faceUp: boolean;
	lift: number;
	highlighted: boolean;
};

export function drawCard(g: Draw2D, card: Card, label: string, look: CardLook): void {
	const { width, height } = CARD;
	const left = -width / 2;
	const top = -height / 2 - look.lift;

	g.roundedRect(left + 2, top + 5 + look.lift * 0.6, width, height, {
		...ROUND,
		color: Palette.shadow,
	});

	if (!look.faceUp) {
		g.roundedRect(left, top, width, height, { ...ROUND, color: Palette.back });
		g.roundedOutline(left + 7, top + 7, width - 14, height - 14, {
			roundness: 0.18,
			thickness: 2,
			color: Palette.backInk,
		});
		g.polygon({ x: 0, y: top + height / 2 }, 4, 13, 45, { color: Palette.backInk });
		return;
	}

	g.roundedRect(left, top, width, height, { ...ROUND, color: Palette.face });
	g.roundedOutline(left, top, width, height, { ...ROUND, color: Palette.faceEdge });

	if (look.highlighted) {
		g.roundedOutline(left, top, width, height, {
			...ROUND,
			thickness: 3,
			color: Palette.glow,
		});
	}

	const ink = isRed(card) ? Palette.red : Palette.black;
	const centre = top + height / 2;

	g.text(label, { x: left + 8, y: top + 7 }, { size: 20, color: ink });
	drawPip(g, card, { x: left + 15, y: top + 38 }, 14, ink);

	drawPip(g, card, { x: 0, y: centre + 4 }, 34, ink);
}
