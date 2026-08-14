// Client side of the relay. Buffers incoming messages so the game can drain
// them inside its fixed step rather than mutating state from a socket callback,
// which would let a move land halfway through a frame.

import {
	type ClientMessage,
	DEFAULT_PORT,
	type GameMessage,
	normalizeCode,
	parse,
	type Role,
	type ServerMessage,
} from './protocol.ts';

export type NetStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'failed';

export type NetEvent =
	| { t: 'created'; code: string }
	| { t: 'joined'; code: string; role: Role }
	| { t: 'peer'; event: 'joined' | 'left' }
	| { t: 'game'; payload: GameMessage }
	| { t: 'error'; reason: string }
	| { t: 'status'; status: NetStatus };

export class Net {
	status: NetStatus = 'idle';
	role: Role | null = null;
	code: string | null = null;
	peerPresent = false;

	#socket: WebSocket | null = null;
	#inbox: NetEvent[] = [];
	#pending: ClientMessage[] = [];

	readonly url: string;

	constructor(url = `ws://localhost:${DEFAULT_PORT}`) {
		this.url = url;
	}

	connect(): void {
		if (this.status === 'connecting' || this.status === 'connected') return;

		this.#setStatus('connecting');

		const socket = new WebSocket(this.url);
		this.#socket = socket;

		socket.addEventListener('open', () => {
			this.#setStatus('connected');

			for (const message of this.#pending) socket.send(JSON.stringify(message));
			this.#pending = [];
		});

		socket.addEventListener('message', (event) => {
			const message = parse<ServerMessage>(String(event.data));
			if (!message) return;

			this.#receive(message);
		});

		// A refused connection and a dropped one look the same to the menu, so
		// both land as a status the UI can show verbatim.
		socket.addEventListener('error', () => this.#setStatus('failed'));
		socket.addEventListener('close', () => {
			this.peerPresent = false;
			this.#setStatus(this.status === 'failed' ? 'failed' : 'closed');
		});
	}

	disconnect(): void {
		this.#socket?.close();
		this.#socket = null;
		this.role = null;
		this.code = null;
		this.peerPresent = false;
	}

	create(): void {
		this.#send({ t: 'create' });
	}

	join(code: string): void {
		this.#send({ t: 'join', code: normalizeCode(code) });
	}

	sendGame(payload: GameMessage): void {
		this.#send({ t: 'game', payload });
	}

	/** Everything received since the last drain, in arrival order. */
	drain(): NetEvent[] {
		const events = this.#inbox;
		this.#inbox = [];

		return events;
	}

	#receive(message: ServerMessage): void {
		if (message.t === 'created') {
			this.role = 'host';
			this.code = message.code;
		}

		if (message.t === 'joined') {
			this.role = message.role;
			this.code = message.code;
			this.peerPresent = true;
		}

		if (message.t === 'peer') this.peerPresent = message.event === 'joined';

		this.#inbox.push(message);
	}

	#send(message: ClientMessage): void {
		if (this.status !== 'connected' || !this.#socket) {
			this.#pending.push(message);
			this.connect();
			return;
		}

		this.#socket.send(JSON.stringify(message));
	}

	#setStatus(status: NetStatus): void {
		if (this.status === status) return;

		this.status = status;
		this.#inbox.push({ t: 'status', status });
	}
}
