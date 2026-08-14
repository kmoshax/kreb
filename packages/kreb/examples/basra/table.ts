// The playing surface. It renders whatever view its controller supplies and
// never learns where that view came from.

import {
	Anchor,
	actions,
	BoxCollider2D,
	type Draw2D,
	type DrawUI,
	Ease,
	input,
	Key,
	Label,
	layer,
	MouseButton,
	mouse,
	Node2D,
	NodeUI,
	Scene,
} from 'kreb';

import { CARD, drawCard, Palette } from './art.ts';
import { backdrop, menuColumn, note, SCREEN, title } from './chrome.ts';
import type { Controller } from './controllers.ts';
import type { MatchView } from './match.ts';
import { type Card, findCapture, isSameCard, otherSeat, RANK_LABEL } from './rules.ts';
import { settings } from './session.ts';

const { width: W, height: H } = SCREEN;
const SIDEBAR = 236;
const FIELD = W - SIDEBAR;

const HAND = { y: H - 96, gap: 92, fan: 0.06, arc: 16 };
const OPPONENT = { y: 84, gap: 58, fan: 0.05, arc: 10 };
const BOARD = { x: FIELD / 2 + 40, y: H / 2 - 20 };

const Layer = { Card: layer(0) };

export const TableAct = actions({
	pick: mouse(MouseButton.MOUSE_BUTTON_LEFT),
	pause: Key.KEY_ESCAPE,
});

const key = (card: Card) => `${card.rank}${card.suit}`;
const labelOf = (card: Card) => `${RANK_LABEL[card.rank]}${card.suit[0]?.toUpperCase()}`;

class CardNode extends BoxCollider2D {
	faceUp = true;
	lift = 0;
	highlighted = false;

	constructor(readonly card: Card) {
		super({ size: [CARD.width, CARD.height], layer: Layer.Card });
	}

	override draw(g: Draw2D): void {
		drawCard(g, this.card, RANK_LABEL[this.card.rank] as string, {
			faceUp: this.faceUp,
			lift: this.lift,
			highlighted: this.highlighted,
		});
	}
}

type RowShape = { gap: number; fan?: number; arc?: number };

/** A fanned row that reconciles itself against a list of cards. */
class Row extends Node2D {
	constructor(
		name: string,
		private readonly shape: RowShape,
	) {
		super(name);
	}

	get cards(): CardNode[] {
		return this.children.filter((child): child is CardNode => child instanceof CardNode);
	}

	/** Keeps nodes whose card is still present, so they animate rather than pop. */
	sync(cards: Card[], faceUp: boolean): void {
		const wanted = cards.map(key);
		const existing = new Map(this.cards.map((node) => [key(node.card), node]));

		for (const [id, node] of existing) {
			if (!wanted.includes(id)) node.destroy();
		}

		for (const card of cards) {
			const node = existing.get(key(card)) ?? this.add(new CardNode(card));
			node.faceUp = faceUp;
		}

		this.layout();
	}

	/** Face-down cards have no identity, so the row only tracks how many. */
	syncHidden(count: number): void {
		const cards = this.cards;

		for (let i = count; i < cards.length; i += 1) cards[i]?.destroy();
		for (let i = cards.length; i < count; i += 1) {
			this.add(new CardNode({ rank: 1, suit: 'spades' })).faceUp = false;
		}

		this.layout();
	}

	layout(): void {
		const cards = this.cards;
		const { gap } = this.shape;
		const fan = settings.fanCards ? (this.shape.fan ?? 0) : 0;
		const arc = settings.fanCards ? (this.shape.arc ?? 0) : 0;
		const start = (-(cards.length - 1) * gap) / 2;

		cards.forEach((card, index) => {
			const spread = cards.length === 1 ? 0 : index / (cards.length - 1) - 0.5;

			this.glide(card, {
				x: start + index * gap,
				y: Math.abs(spread) * 2 * arc,
				rotation: spread * 2 * fan,
			});
		});
	}

	/** `from` is captured once: reading it live would chase a moving target. */
	private glide(card: CardNode, to: { x: number; y: number; rotation: number }): void {
		const from = { x: card.x, y: card.y, rotation: card.rotation };
		if (from.x === to.x && from.y === to.y && from.rotation === to.rotation) return;

		this.scene.tweens.run(0.22, Ease.OutCubic, (t) => {
			card.x = from.x + (to.x - from.x) * t;
			card.y = from.y + (to.y - from.y) * t;
			card.rotation = from.rotation + (to.rotation - from.rotation) * t;
		});
	}
}

class Felt extends Node2D {
	deckLeft = 0;
	mine = 0;
	theirs = 0;

	override draw(g: Draw2D): void {
		g.gradient(0, 0, W, H, { from: Palette.felt, to: Palette.feltEdge });
		g.ring({ x: FIELD / 2, y: H / 2 }, 232, 236, { color: 0xffffff10 });

		this.stack(g, { x: 96, y: H / 2 }, this.deckLeft);
		this.stack(g, { x: 96, y: OPPONENT.y }, this.theirs);
		this.stack(g, { x: 96, y: HAND.y }, this.mine);
	}

	/** A pile reads as depth: a few offset backs, not one card per card. */
	private stack(g: Draw2D, at: { x: number; y: number }, count: number): void {
		for (let i = 0; i < Math.min(Math.ceil(count / 6), 6); i += 1) {
			g.roundedRect(
				at.x - CARD.width / 2 + i,
				at.y - CARD.height / 2 - i * 2,
				CARD.width,
				CARD.height,
				{ roundness: 0.14, color: Palette.back },
			);
		}

		if (count > 0) {
			g.text(`${count}`, { x: at.x - 8, y: at.y + CARD.height / 2 + 10 }, { size: 18 });
		}
	}
}

class Sidebar extends NodeUI {
	override draw(g: DrawUI): void {
		g.rect(0, 0, g.width, g.height, { color: 0x0f1a16cc });
		g.rect(0, 0, 2, g.height, { color: 0xffffff14 });
	}
}

export class TableScene extends Scene {
	readonly felt = this.add(new Felt('felt'));

	readonly hand = this.add(new Row('hand', HAND)).at(FIELD / 2, HAND.y);
	readonly board = this.add(new Row('board', { gap: 96 })).at(BOARD.x, BOARD.y);
	readonly opponentRow = this.add(new Row('opponentRow', OPPONENT)).at(FIELD / 2, OPPONENT.y);

	readonly status = new Label('', 'status');
	readonly lastMove = new Label('', 'lastMove');
	readonly theirScore = new Label('', 'theirScore');
	readonly yourScore = new Label('', 'yourScore');

	#finishedShown = false;

	/** `onExit` is passed in so the table never has to know the menu exists. */
	constructor(
		readonly controller: Controller,
		readonly onExit: () => void,
	) {
		super('table');
	}

	override ready(): void {
		this.add(new Sidebar()).place({
			anchor: Anchor.TopRight,
			x: -SIDEBAR,
			width: SIDEBAR,
			height: H,
		});

		this.tag('THEM', 40);
		this.add(this.theirScore).place({ anchor: Anchor.TopRight, x: -SIDEBAR + 24, y: 66 });

		this.tag('YOU', 150);
		this.add(this.yourScore).place({ anchor: Anchor.TopRight, x: -SIDEBAR + 24, y: 176 });

		this.tag(this.controller.label, 260);
		this.tag('Esc for menu', 292);

		this.add(this.status).place({ anchor: Anchor.TopLeft, x: 28, y: 24 });
		this.add(this.lastMove).place({ anchor: Anchor.BottomLeft, x: 28, y: -34 });
		this.lastMove.muted = true;
	}

	private tag(text: string, y: number): void {
		const label = this.add(new Label(text));
		label.muted = true;
		label.place({ anchor: Anchor.TopRight, x: -SIDEBAR + 24, y });
	}

	override update(dt: number): void {
		this.controller.update(dt);

		if (input.pressed(TableAct.pause)) {
			this.scenes.push(new PauseScene(this));
			return;
		}

		const view = this.controller.view;
		if (!view) {
			this.status.text = this.controller.blocked ?? 'Connecting...';
			return;
		}

		this.sync(view);
		this.hover(view);

		if (view.finished) {
			if (!this.#finishedShown) {
				this.#finishedShown = true;
				this.scenes.push(new ResultScene(this, view));
			}
			return;
		}

		this.#finishedShown = false;
		this.takeTurn(view);
	}

	private sync(view: MatchView): void {
		this.hand.sync(view.hand, true);
		this.board.sync(view.table, true);
		this.opponentRow.syncHidden(view.opponentHand);

		this.felt.deckLeft = view.deckLeft;
		this.felt.mine = view.taken[view.seat];
		this.felt.theirs = view.taken[otherSeat(view.seat)];

		const them = otherSeat(view.seat);
		this.theirScore.text = `${view.scores[them]}  ·  ${view.taken[them]} cards`;
		this.yourScore.text = `${view.scores[view.seat]}  ·  ${view.taken[view.seat]} cards`;

		this.status.text =
			this.controller.blocked ?? (view.turn === view.seat ? 'Your turn' : 'Their turn');

		if (view.lastMove) {
			const move = view.lastMove;
			const who = move.by === view.seat ? 'You' : 'They';
			const what = labelOf(move.card);

			this.lastMove.text = move.basra
				? `${who} played ${what} — BASRA!`
				: move.captured.length > 0
					? `${who} played ${what} and took ${move.captured.length}`
					: `${who} laid ${what}`;
		}
	}

	/** The card under the pointer rises and marks what it would capture. */
	private hover(view: MatchView): void {
		const under = this.cardsUnderPointer();
		const myTurn = view.turn === view.seat && !this.controller.blocked;

		for (const card of this.board.cards) card.highlighted = false;

		for (const card of this.hand.cards) {
			const active = myTurn && under.includes(card);
			card.lift = active ? 18 : 0;

			if (!active || !settings.showCaptureHints) continue;

			const preview = findCapture(card.card, view.table);
			for (const child of this.board.cards) {
				if (preview.some((taken) => isSameCard(taken, child.card))) child.highlighted = true;
			}
		}
	}

	private cardsUnderPointer(): CardNode[] {
		const { x, y } = input.mouse;

		return this.collisions
			.overlapVolume({ kind: 'box', center: [x, y], half: [1, 1] }, Layer.Card)
			.map((overlap) => overlap.collider)
			.filter((collider): collider is CardNode => collider instanceof CardNode);
	}

	private takeTurn(view: MatchView): void {
		if (view.turn !== view.seat || this.controller.blocked) return;
		if (!input.pressed(TableAct.pick)) return;

		const inHand = this.hand.cards;
		const picked = this.cardsUnderPointer().find((card) => inHand.includes(card));

		if (picked) this.controller.play(picked.card);
	}

	override exitTree(): void {
		this.controller.leave();
	}
}

/** Escape overlay. The table keeps drawing underneath. */
export class PauseScene extends Scene {
	constructor(private readonly table: TableScene) {
		super('pause');
	}

	override ready(): void {
		backdrop(this, 1);
		title(this, 'Paused', this.table.controller.label, 96, 200);

		menuColumn(
			this,
			[
				{ label: 'Resume', onPress: () => this.scenes.pop() },
				{ label: 'Leave to menu', onPress: () => this.table.onExit() },
			],
			{ y: 320 },
		);
	}

	override update(): void {
		if (input.pressed(TableAct.pause)) this.scenes.pop();
	}
}

export class ResultScene extends Scene {
	constructor(
		private readonly table: TableScene,
		private readonly view: MatchView,
	) {
		super('result');
	}

	override ready(): void {
		const them = otherSeat(this.view.seat);
		const mine = this.view.scores[this.view.seat];
		const theirs = this.view.scores[them];

		backdrop(this, 1);
		title(
			this,
			mine === theirs ? 'Draw' : mine > theirs ? 'You win' : 'You lose',
			`${mine} — ${theirs}`,
			96,
			180,
		);

		note(this, `cards ${this.view.taken[this.view.seat]} to ${this.view.taken[them]}`, 300);

		menuColumn(
			this,
			[
				{
					label: 'Rematch',
					onPress: () => {
						this.table.controller.rematch();
						this.scenes.pop();
					},
				},
				{ label: 'Leave to menu', onPress: () => this.table.onExit() },
			],
			{ y: 350 },
		);
	}
}
