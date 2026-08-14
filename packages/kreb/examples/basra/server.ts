// Room relay: bun packages/kreb/examples/basra/server.ts [port]
//
// Two sockets share a code. Whoever created it is the host and owns the rules;
// this process only copies messages across and reports arrivals and departures.

import type { ServerWebSocket } from 'bun';
import {
	type ClientMessage,
	DEFAULT_PORT,
	makeCode,
	normalizeCode,
	parse,
	type Role,
	type ServerMessage,
} from './protocol.ts';

type Peer = { code: string | null; role: Role | null };

type Room = {
	host: ServerWebSocket<Peer> | null;
	guest: ServerWebSocket<Peer> | null;
};

const rooms = new Map<string, Room>();

function send(socket: ServerWebSocket<Peer>, message: ServerMessage): void {
	socket.send(JSON.stringify(message));
}

function partner(socket: ServerWebSocket<Peer>): ServerWebSocket<Peer> | null {
	const room = socket.data.code ? rooms.get(socket.data.code) : undefined;
	if (!room) return null;

	return socket.data.role === 'host' ? room.guest : room.host;
}

function freshCode(): string {
	// Codes are short, so on the rare clash just draw again.
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const code = makeCode();
		if (!rooms.has(code)) return code;
	}

	throw new Error('Could not find a free room code');
}

function leave(socket: ServerWebSocket<Peer>): void {
	const code = socket.data.code;
	if (!code) return;

	const room = rooms.get(code);
	if (!room) return;

	const other = partner(socket);
	if (other) send(other, { t: 'peer', event: 'left' });

	if (socket.data.role === 'host') room.host = null;
	else room.guest = null;

	if (!room.host && !room.guest) rooms.delete(code);

	socket.data.code = null;
	socket.data.role = null;
}

function handle(socket: ServerWebSocket<Peer>, message: ClientMessage): void {
	switch (message.t) {
		case 'create': {
			leave(socket);

			const code = freshCode();
			rooms.set(code, { host: socket, guest: null });

			socket.data.code = code;
			socket.data.role = 'host';

			send(socket, { t: 'created', code });
			return;
		}

		case 'join': {
			const code = normalizeCode(message.code);
			const room = rooms.get(code);

			if (!room?.host) return send(socket, { t: 'error', reason: `No room "${code}"` });
			if (room.guest) return send(socket, { t: 'error', reason: `Room "${code}" is full` });

			leave(socket);
			room.guest = socket;
			socket.data.code = code;
			socket.data.role = 'guest';

			send(socket, { t: 'joined', code, role: 'guest' });
			send(room.host, { t: 'peer', event: 'joined' });
			return;
		}

		case 'game': {
			const other = partner(socket);
			if (other) send(other, { t: 'game', payload: message.payload });
			return;
		}
	}
}

const port = Number(process.argv[2] ?? DEFAULT_PORT);

const server = Bun.serve<Peer, never>({
	port,
	fetch(request, self) {
		if (self.upgrade(request, { data: { code: null, role: null } })) return undefined;

		return new Response('basra relay: connect over websocket', { status: 426 });
	},
	websocket: {
		message(socket, raw) {
			const message = parse<ClientMessage>(String(raw));
			if (!message) return send(socket, { t: 'error', reason: 'Malformed message' });

			handle(socket, message);
		},
		close(socket) {
			leave(socket);
		},
	},
});

console.log(`basra relay listening on ws://localhost:${server.port}`);
