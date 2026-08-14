import { expect, test } from 'bun:test';
import { HAND_SIZE, Match, TABLE_SIZE } from '../examples/basra/match.ts';
import type { Card, Seat } from '../examples/basra/rules.ts';

/** Deterministic shuffle, so a failure is reproducible. */
function seeded(seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 1664525 + 1013904223) % 2 ** 32;
		return state / 2 ** 32;
	};
}

function playOut(match: Match, limit = 200): number {
	let moves = 0;

	while (!match.finished && moves < limit) {
		const seat = match.turn;
		const card = match.hands[seat][0];
		if (!card) break;

		match.play(seat, card);
		moves += 1;
	}

	return moves;
}

test('a new match deals a table and two hands', () => {
	const match = new Match(seeded(1));

	expect(match.table.length).toBe(TABLE_SIZE);
	expect(match.hands.a.length).toBe(HAND_SIZE);
	expect(match.hands.b.length).toBe(HAND_SIZE);
	expect(match.deck.length).toBe(52 - TABLE_SIZE - HAND_SIZE * 2);
	expect(match.turn).toBe('a');
});

test('playing out of turn is refused', () => {
	const match = new Match(seeded(2));
	const card = match.hands.b[0] as Card;

	expect(match.play('b', card)).toBeNull();
	expect(match.hands.b.length).toBe(HAND_SIZE);
});

test('playing a card you do not hold is refused', () => {
	const match = new Match(seeded(3));
	const notMine = match.deck[0] as Card;

	expect(match.play('a', notMine)).toBeNull();
});

test('a move leaves the hand and passes the turn', () => {
	const match = new Match(seeded(4));
	const card = match.hands.a[0] as Card;

	const move = match.play('a', card);

	expect(move?.by).toBe('a');
	expect(match.hands.a.length).toBe(HAND_SIZE - 1);
	expect(match.turn).toBe('b');
});

test('hands refill once both are empty', () => {
	const match = new Match(seeded(5));

	for (let i = 0; i < HAND_SIZE * 2; i += 1) {
		const seat = match.turn;
		match.play(seat, match.hands[seat][0] as Card);
	}

	expect(match.hands.a.length).toBe(HAND_SIZE);
	expect(match.hands.b.length).toBe(HAND_SIZE);
});

test('a full match ends with every card accounted for', () => {
	const match = new Match(seeded(6));
	playOut(match);

	expect(match.finished).toBe(true);
	expect(match.table.length).toBe(0);
	expect(match.deck.length).toBe(0);

	const held = match.piles.a.cards.length + match.piles.b.cards.length;
	expect(held).toBe(52);
});

test('the last capturer sweeps the leftovers', () => {
	const match = new Match(seeded(7));
	playOut(match);

	const winner = match.lastCapturedBy ?? 'a';
	expect(match.piles[winner].cards.length).toBeGreaterThan(0);
});

test('a finished match refuses further moves', () => {
	const match = new Match(seeded(8));
	playOut(match);

	expect(match.play(match.turn, { rank: 5, suit: 'hearts' })).toBeNull();
});

test('a view shows only that seat"s hand', () => {
	const match = new Match(seeded(9));

	for (const seat of ['a', 'b'] as Seat[]) {
		const view = match.view(seat);

		expect(view.seat).toBe(seat);
		expect(view.hand).toEqual(match.hands[seat]);
		expect(view.opponentHand).toBe(HAND_SIZE);

		// The opponent's actual cards must never travel over the wire.
		expect(JSON.stringify(view)).not.toContain('"opponentCards"');
	}
});

test('a view survives a JSON round trip, which is how it reaches the guest', () => {
	const match = new Match(seeded(10));
	match.play('a', match.hands.a[0] as Card);

	const view = match.view('b');
	const wire = JSON.parse(JSON.stringify(view));

	expect(wire).toEqual(view);
	expect(wire.lastMove.by).toBe('a');
});

test('reset deals a fresh match', () => {
	const match = new Match(seeded(11));
	playOut(match);

	match.reset();

	expect(match.finished).toBe(false);
	expect(match.deck.length).toBe(52 - TABLE_SIZE - HAND_SIZE * 2);
	expect(match.lastMove).toBeNull();
});
