import { expect, test } from 'bun:test';
import {
	buildDeck,
	type Card,
	chooseCard,
	findCapture,
	isBasra,
	pilePoints,
	scoreRound,
	shuffle,
} from '../examples/basra/rules.ts';

const card = (rank: number, suit: Card['suit'] = 'spades'): Card => ({ rank, suit });

test('a deck has 52 distinct cards', () => {
	const deck = buildDeck();
	const distinct = new Set(deck.map((c) => `${c.rank}${c.suit}`));

	expect(deck.length).toBe(52);
	expect(distinct.size).toBe(52);
});

test('shuffling keeps every card', () => {
	const deck = buildDeck();
	const shuffled = shuffle(deck, () => 0.42);

	expect(shuffled.length).toBe(52);
	expect(new Set(shuffled.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);

	// The original is untouched, so a caller can reshuffle from it.
	expect(deck[0]).toEqual(buildDeck()[0] as Card);
});

test('a matching rank captures every card of that rank', () => {
	const table = [card(7, 'hearts'), card(7, 'clubs'), card(3)];

	expect(findCapture(card(7, 'spades'), table)).toEqual([card(7, 'hearts'), card(7, 'clubs')]);
});

test('a numeric card captures a set summing to it', () => {
	const table = [card(3), card(4, 'hearts'), card(9)];

	expect(findCapture(card(7, 'clubs'), table)).toEqual([card(3), card(4, 'hearts')]);
});

test('rank matching wins over summing', () => {
	const table = [card(7, 'hearts'), card(3), card(4, 'clubs')];

	expect(findCapture(card(7, 'spades'), table)).toEqual([card(7, 'hearts')]);
});

test('a jack takes the whole table', () => {
	const table = [card(13), card(2, 'hearts'), card(9, 'clubs')];

	expect(findCapture(card(11, 'diamonds'), table)).toEqual(table);
});

test('the seven of diamonds sweeps a table with no face cards', () => {
	const numeric = [card(9), card(2, 'hearts'), card(10, 'clubs')];
	expect(findCapture(card(7, 'diamonds'), numeric)).toEqual(numeric);

	// A king on the table blocks the sweep, leaving it an ordinary seven.
	const withFace = [...numeric, card(13)];
	expect(findCapture(card(7, 'diamonds'), withFace)).toEqual([]);
});

test('a face card that matches nothing captures nothing', () => {
	expect(findCapture(card(12), [card(3), card(4)])).toEqual([]);
});

test('nothing can be captured from an empty table', () => {
	expect(findCapture(card(11), [])).toEqual([]);
});

test('clearing the table is a basra, unless it was a jack', () => {
	const table = [card(5), card(2, 'hearts')];

	expect(isBasra(card(7), table, findCapture(card(7), table))).toBe(true);
	expect(isBasra(card(11), table, table)).toBe(false);
	expect(isBasra(card(5), table, [card(5)])).toBe(false);
});

test('pile points count aces, the two of clubs and the ten of diamonds', () => {
	const pile = {
		cards: [card(1, 'spades'), card(1, 'hearts'), card(2, 'clubs'), card(10, 'diamonds'), card(9)],
		basras: 0,
	};

	expect(pilePoints(pile)).toBe(1 + 1 + 2 + 3);

	expect(pilePoints({ cards: [], basras: 2 })).toBe(20);
});

test('the larger pile takes the most-cards bonus', () => {
	const many = { cards: Array.from({ length: 30 }, () => card(9)), basras: 0 };
	const few = { cards: Array.from({ length: 22 }, () => card(9)), basras: 0 };

	expect(scoreRound({ a: many, b: few })).toEqual({ a: 3, b: 0 });
	expect(scoreRound({ a: few, b: many })).toEqual({ a: 0, b: 3 });

	// A tie awards it to nobody.
	expect(scoreRound({ a: few, b: { ...few } })).toEqual({ a: 0, b: 0 });
});

test('the opponent prefers a basra over a bigger ordinary capture', () => {
	const table = [card(4), card(3, 'hearts')];
	const hand = [card(7, 'clubs'), card(4, 'diamonds')];

	// 7 sums the whole table and clears it; 4 would only match one card.
	expect(chooseCard(hand, table)).toEqual(card(7, 'clubs'));
});

test('with no capture available the opponent sheds its lowest card', () => {
	const table = [card(13)];
	const hand = [card(9, 'clubs'), card(2, 'hearts'), card(6)];

	expect(chooseCard(hand, table)).toEqual(card(2, 'hearts'));
});
