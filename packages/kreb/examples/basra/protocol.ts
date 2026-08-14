// Messages shared by the relay and the clients.
//
// The relay is deliberately dumb: it pairs two sockets under a code and copies
// `game` payloads between them. All rules live on the host, so the server never
// needs to understand basra.

import type { MatchView } from './match.ts';
import type { Card } from './rules.ts';

export const DEFAULT_PORT = 7777;
export const ROOM_CODE_LENGTH = 4;

/** No vowels and no look-alikes, so a code can be read aloud or typed wrong less. */
export const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789';

export type Role = 'host' | 'guest';

export type ClientMessage =
	| { t: 'create' }
	| { t: 'join'; code: string }
	| { t: 'game'; payload: GameMessage };

export type ServerMessage =
	| { t: 'created'; code: string }
	| { t: 'joined'; code: string; role: Role }
	| { t: 'peer'; event: 'joined' | 'left' }
	| { t: 'game'; payload: GameMessage }
	| { t: 'error'; reason: string };

export type GameMessage =
	| { t: 'state'; view: MatchView }
	| { t: 'play'; card: Card }
	| { t: 'rematch' };

export function makeCode(random: () => number = Math.random): string {
	let code = '';

	for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
		code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
	}

	return code;
}

export function normalizeCode(input: string): string {
	return input.trim().toUpperCase().slice(0, ROOM_CODE_LENGTH);
}

export function parse<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}
