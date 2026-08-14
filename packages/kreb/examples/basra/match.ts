// The whole game as data. No framework, no rendering, no network.
//
// One Match runs on the host. The guest holds a view of it and sends moves
// back; making the host authoritative means a dropped or reordered message can
// never desync the two screens, which a lockstep model would have to solve.

import {
	buildDeck,
	type Card,
	findCapture,
	isBasra,
	isSameCard,
	otherSeat,
	type Pile,
	type Seat,
	scoreRound,
	shuffle,
} from './rules.ts';

export const HAND_SIZE = 4;
export const TABLE_SIZE = 4;

export type Move = {
	by: Seat;
	card: Card;
	captured: Card[];
	basra: boolean;
};

/** What one seat is allowed to know: its own hand, and counts for the rest. */
export type MatchView = {
	seat: Seat;
	hand: Card[];
	table: Card[];
	opponentHand: number;
	deckLeft: number;
	taken: Record<Seat, number>;
	scores: Record<Seat, number>;
	turn: Seat;
	finished: boolean;
	lastMove: Move | null;
};

const emptyPiles = (): Record<Seat, Pile> => ({
	a: { cards: [], basras: 0 },
	b: { cards: [], basras: 0 },
});

export class Match {
	deck: Card[] = [];
	table: Card[] = [];
	hands: Record<Seat, Card[]> = { a: [], b: [] };
	piles = emptyPiles();

	turn: Seat = 'a';
	lastCapturedBy: Seat | null = null;
	finished = false;
	lastMove: Move | null = null;

	constructor(private readonly random: () => number = Math.random) {
		this.reset();
	}

	reset(): void {
		this.deck = shuffle(buildDeck(), this.random);
		this.table = this.deck.splice(0, TABLE_SIZE);
		this.hands = { a: [], b: [] };
		this.piles = emptyPiles();

		this.turn = 'a';
		this.lastCapturedBy = null;
		this.finished = false;
		this.lastMove = null;

		this.deal();
	}

	deal(): void {
		for (const seat of ['a', 'b'] as const) {
			this.hands[seat] = this.deck.splice(0, HAND_SIZE);
		}
	}

	legal(seat: Seat, card: Card): boolean {
		if (this.finished || seat !== this.turn) return false;

		return this.hands[seat].some((held) => isSameCard(held, card));
	}

	/** Applies a move, or returns null when it was not that seat's to make. */
	play(seat: Seat, card: Card): Move | null {
		if (!this.legal(seat, card)) return null;

		const captured = findCapture(card, this.table);
		const basra = isBasra(card, this.table, captured);

		this.hands[seat] = this.hands[seat].filter((held) => !isSameCard(held, card));

		if (captured.length === 0) {
			this.table.push(card);
		} else {
			this.table = this.table.filter(
				(onTable) => !captured.some((taken) => isSameCard(taken, onTable)),
			);

			this.piles[seat].cards.push(...captured, card);
			if (basra) this.piles[seat].basras += 1;
			this.lastCapturedBy = seat;
		}

		this.turn = otherSeat(seat);
		this.lastMove = { by: seat, card, captured, basra };

		this.advanceRound();

		return this.lastMove;
	}

	/** Refill when both hands empty; end and award the leftovers when dry. */
	private advanceRound(): void {
		if (this.hands.a.length > 0 || this.hands.b.length > 0) return;

		if (this.deck.length > 0) {
			this.deal();
			return;
		}

		const winner = this.lastCapturedBy ?? 'a';
		this.piles[winner].cards.push(...this.table);

		this.table = [];
		this.finished = true;
	}

	scores(): Record<Seat, number> {
		return scoreRound(this.piles);
	}

	view(seat: Seat): MatchView {
		return {
			seat,
			hand: [...this.hands[seat]],
			table: [...this.table],
			opponentHand: this.hands[otherSeat(seat)].length,
			deckLeft: this.deck.length,
			taken: { a: this.piles.a.cards.length, b: this.piles.b.cards.length },
			scores: this.scores(),
			turn: this.turn,
			finished: this.finished,
			lastMove: this.lastMove,
		};
	}
}
