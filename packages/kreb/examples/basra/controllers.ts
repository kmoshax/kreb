// Three ways to supply moves, behind one interface, so the table scene never
// learns whether its opponent is a bot, a peer, or itself.

import { Match, type MatchView } from './match.ts';
import type { Net } from './net.ts';
import { type Card, chooseCard, type Seat } from './rules.ts';

export type Controller = {
	readonly label: string;
	readonly seat: Seat;
	/** Null while a guest is still waiting for the host's first state. */
	readonly view: MatchView | null;
	/** A message for the player when play cannot continue yet. */
	readonly blocked: string | null;
	play(card: Card): void;
	rematch(): void;
	update(dt: number): void;
	leave(): void;
};

/** Local game: the model lives here and seat b is played by the bot. */
export class AiController implements Controller {
	readonly label = 'vs computer';
	readonly seat: Seat = 'a';

	#match = new Match();
	#thinking = 0;

	constructor(private readonly delay: () => number) {}

	get view(): MatchView {
		return this.#match.view(this.seat);
	}

	get blocked(): string | null {
		return null;
	}

	play(card: Card): void {
		if (this.#match.play(this.seat, card)) this.#thinking = this.delay();
	}

	rematch(): void {
		this.#match.reset();
		this.#thinking = 0;
	}

	update(dt: number): void {
		if (this.#match.finished || this.#match.turn !== 'b') return;

		this.#thinking -= dt;
		if (this.#thinking > 0) return;

		const hand = this.#match.hands.b;
		if (hand.length === 0) return;

		this.#match.play('b', chooseCard(hand, this.#match.table));
	}

	leave(): void {}
}

/** Online host: owns the model and broadcasts a view after every change. */
export class HostController implements Controller {
	readonly label = 'online — host';
	readonly seat: Seat = 'a';

	#match = new Match();

	constructor(private readonly net: Net) {
		this.broadcast();
	}

	get view(): MatchView {
		return this.#match.view(this.seat);
	}

	get blocked(): string | null {
		return this.net.peerPresent ? null : 'Waiting for the other player...';
	}

	play(card: Card): void {
		if (!this.net.peerPresent) return;
		if (this.#match.play(this.seat, card)) this.broadcast();
	}

	rematch(): void {
		this.#match.reset();
		this.broadcast();
	}

	update(_dt: number): void {
		for (const event of this.net.drain()) {
			if (event.t === 'peer' && event.event === 'joined') this.broadcast();
			if (event.t !== 'game') continue;

			// The guest can only ever ask; the host decides whether it was legal.
			if (event.payload.t === 'play' && this.#match.play('b', event.payload.card)) {
				this.broadcast();
			}

			if (event.payload.t === 'rematch') this.rematch();
		}
	}

	leave(): void {
		this.net.disconnect();
	}

	private broadcast(): void {
		this.net.sendGame({ t: 'state', view: this.#match.view('b') });
	}
}

/** Online guest: holds the host's latest view and asks to play a card. */
export class GuestController implements Controller {
	readonly label = 'online — guest';
	readonly seat: Seat = 'b';

	#view: MatchView | null = null;
	#lost = false;

	constructor(private readonly net: Net) {}

	get view(): MatchView | null {
		return this.#view;
	}

	get blocked(): string | null {
		if (this.#lost) return 'The host left the room';

		return this.#view ? null : 'Waiting for the host...';
	}

	play(card: Card): void {
		if (this.#view?.turn !== this.seat) return;

		this.net.sendGame({ t: 'play', card });
	}

	rematch(): void {
		this.net.sendGame({ t: 'rematch' });
	}

	update(_dt: number): void {
		for (const event of this.net.drain()) {
			if (event.t === 'peer' && event.event === 'left') this.#lost = true;
			if (event.t === 'game' && event.payload.t === 'state') this.#view = event.payload.view;
		}
	}

	leave(): void {
		this.net.disconnect();
	}
}
