// Basra (باصرة) rules as plain TypeScript: no framework, no rendering.
//
// Basra has regional variants. The set used here:
//   - a played card captures every table card of the same rank
//   - a numeric card may instead capture any set of numeric cards summing to it
//   - a jack captures the whole table
//   - the 7 of diamonds captures the whole table when no face card is on it
//   - clearing the table with a non-jack is a "basra" and scores extra
//
// Scoring: each ace 1, 2 of clubs 2, 10 of diamonds 3, most cards 3, basra 10.

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export type Card = { rank: number; suit: Suit };

export const JACK = 11;
export const QUEEN = 12;
export const KING = 13;

export const RANK_LABEL = [
	'',
	'A',
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'J',
	'Q',
	'K',
] as const;

export const BASRA_POINTS = 10;
export const MOST_CARDS_POINTS = 3;

export function isRed(card: Card): boolean {
	return card.suit === 'hearts' || card.suit === 'diamonds';
}

/** Only ace through ten take part in sum captures. */
export function isNumeric(card: Card): boolean {
	return card.rank <= 10;
}

export function isSameCard(a: Card, b: Card): boolean {
	return a.rank === b.rank && a.suit === b.suit;
}

export function sevenOfDiamonds(card: Card): boolean {
	return card.rank === 7 && card.suit === 'diamonds';
}

export function buildDeck(): Card[] {
	return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })));
}

export function shuffle(cards: Card[], random: () => number = Math.random): Card[] {
	const out = [...cards];

	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j] as Card, out[i] as Card];
	}

	return out;
}

/** Largest group of numeric cards adding up to `total`, or none. */
function subsetSummingTo(table: Card[], total: number): Card[] {
	const numeric = table.filter(isNumeric);
	let best: Card[] = [];

	// The table holds a handful of cards, so trying every combination is fine.
	for (let mask = 1; mask < 1 << numeric.length; mask += 1) {
		const picked = numeric.filter((_, i) => (mask & (1 << i)) !== 0);
		if (picked.length < 2) continue;

		const sum = picked.reduce((running, card) => running + card.rank, 0);
		if (sum === total && picked.length > best.length) best = picked;
	}

	return best;
}

/** Cards the played card takes. Empty means it stays on the table. */
export function findCapture(played: Card, table: Card[]): Card[] {
	if (table.length === 0) return [];

	if (played.rank === JACK) return [...table];
	if (sevenOfDiamonds(played) && table.every(isNumeric)) return [...table];

	const sameRank = table.filter((card) => card.rank === played.rank);
	if (sameRank.length > 0) return sameRank;

	return isNumeric(played) ? subsetSummingTo(table, played.rank) : [];
}

/** Clearing the table with anything but a jack. */
export function isBasra(played: Card, table: Card[], captured: Card[]): boolean {
	return played.rank !== JACK && table.length > 0 && captured.length === table.length;
}

/** Seats are neutral so the same model serves the host, the guest and the AI. */
export type Seat = 'a' | 'b';

export const SEATS: readonly Seat[] = ['a', 'b'];

export function otherSeat(seat: Seat): Seat {
	return seat === 'a' ? 'b' : 'a';
}

export type Pile = {
	cards: Card[];
	basras: number;
};

export function pilePoints(pile: Pile): number {
	let points = pile.basras * BASRA_POINTS;

	for (const card of pile.cards) {
		if (card.rank === 1) points += 1;
		else if (card.rank === 2 && card.suit === 'clubs') points += 2;
		else if (card.rank === 10 && card.suit === 'diamonds') points += 3;
	}

	return points;
}

export function scoreRound(piles: Record<Seat, Pile>): Record<Seat, number> {
	const scores: Record<Seat, number> = { a: pilePoints(piles.a), b: pilePoints(piles.b) };

	if (piles.a.cards.length > piles.b.cards.length) scores.a += MOST_CARDS_POINTS;
	else if (piles.b.cards.length > piles.a.cards.length) scores.b += MOST_CARDS_POINTS;

	return scores;
}

/**
 * Opponent policy: take a basra, else take the most cards, else shed the least
 * useful card. Deliberately simple, so the example stays about the framework.
 */
export function chooseCard(hand: Card[], table: Card[]): Card {
	let best = hand[0] as Card;
	let bestScore = -1;

	for (const card of hand) {
		const captured = findCapture(card, table);

		let score = captured.length;
		if (isBasra(card, table, captured)) score += 20;
		if (captured.length === 0) score = -card.rank / 100;

		if (score > bestScore) {
			bestScore = score;
			best = card;
		}
	}

	return best;
}
