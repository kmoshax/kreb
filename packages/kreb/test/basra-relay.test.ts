// Drives the real relay over real sockets. Netcode that is only reasoned about
// is netcode that does not work, so this starts the server and talks to it.

import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Subprocess } from 'bun';
import type { ClientMessage, ServerMessage } from '../examples/basra/protocol.ts';

const PORT = 7911;
const SERVER = new URL('../examples/basra/server.ts', import.meta.url).pathname;

let server: Subprocess;

/** A socket that queues what it receives, so a test can await the next one. */
class Peer {
	readonly socket: WebSocket;
	readonly received: ServerMessage[] = [];

	#waiters: ((message: ServerMessage) => void)[] = [];

	constructor() {
		this.socket = new WebSocket(`ws://localhost:${PORT}`);

		this.socket.addEventListener('message', (event) => {
			const message = JSON.parse(String(event.data)) as ServerMessage;

			const waiter = this.#waiters.shift();
			if (waiter) waiter(message);
			else this.received.push(message);
		});
	}

	async open(): Promise<this> {
		if (this.socket.readyState === WebSocket.OPEN) return this;

		await new Promise<void>((resolve, reject) => {
			this.socket.addEventListener('open', () => resolve(), { once: true });
			this.socket.addEventListener('error', () => reject(new Error('connect failed')), {
				once: true,
			});
		});

		return this;
	}

	send(message: ClientMessage): void {
		this.socket.send(JSON.stringify(message));
	}

	next(timeout = 2000): Promise<ServerMessage> {
		const queued = this.received.shift();
		if (queued) return Promise.resolve(queued);

		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('timed out waiting for a message')), timeout);

			this.#waiters.push((message) => {
				clearTimeout(timer);
				resolve(message);
			});
		});
	}

	close(): void {
		this.socket.close();
	}
}

beforeAll(async () => {
	server = Bun.spawn(['bun', SERVER, String(PORT)], { stdout: 'pipe', stderr: 'pipe' });

	// Wait for the listener rather than sleeping a fixed amount.
	for (let attempt = 0; attempt < 100; attempt += 1) {
		try {
			await new Peer().open().then((peer) => peer.close());
			return;
		} catch {
			await Bun.sleep(20);
		}
	}

	throw new Error('relay did not start');
});

afterAll(() => {
	server.kill();
});

test('creating a room returns a code', async () => {
	const host = await new Peer().open();
	host.send({ t: 'create' });

	const message = await host.next();
	expect(message.t).toBe('created');
	if (message.t !== 'created') throw new Error('unreachable');

	expect(message.code).toMatch(/^[A-Z0-9]{4}$/);
	host.close();
});

test('joining an unknown code reports it instead of hanging', async () => {
	const guest = await new Peer().open();
	guest.send({ t: 'join', code: 'ZZZZ' });

	const message = await guest.next();
	expect(message.t).toBe('error');
	if (message.t !== 'error') throw new Error('unreachable');

	expect(message.reason).toContain('ZZZZ');
	guest.close();
});

test('two peers pair up and relay game payloads both ways', async () => {
	const host = await new Peer().open();
	host.send({ t: 'create' });

	const created = await host.next();
	if (created.t !== 'created') throw new Error('expected a code');

	const guest = await new Peer().open();
	guest.send({ t: 'join', code: created.code });

	expect((await guest.next()).t).toBe('joined');
	expect(await host.next()).toEqual({ t: 'peer', event: 'joined' });

	// Host to guest.
	host.send({ t: 'game', payload: { t: 'rematch' } });
	expect(await guest.next()).toEqual({ t: 'game', payload: { t: 'rematch' } });

	// Guest to host.
	const card = { rank: 7, suit: 'diamonds' } as const;
	guest.send({ t: 'game', payload: { t: 'play', card } });
	expect(await host.next()).toEqual({ t: 'game', payload: { t: 'play', card } });

	host.close();
	guest.close();
});

test('a full room refuses a third peer', async () => {
	const host = await new Peer().open();
	host.send({ t: 'create' });

	const created = await host.next();
	if (created.t !== 'created') throw new Error('expected a code');

	const guest = await new Peer().open();
	guest.send({ t: 'join', code: created.code });
	await guest.next();
	await host.next();

	const third = await new Peer().open();
	third.send({ t: 'join', code: created.code });

	const refused = await third.next();
	expect(refused.t).toBe('error');
	if (refused.t !== 'error') throw new Error('unreachable');
	expect(refused.reason).toContain('full');

	host.close();
	guest.close();
	third.close();
});

test('the survivor is told when the other side drops', async () => {
	const host = await new Peer().open();
	host.send({ t: 'create' });

	const created = await host.next();
	if (created.t !== 'created') throw new Error('expected a code');

	const guest = await new Peer().open();
	guest.send({ t: 'join', code: created.code });
	await guest.next();
	await host.next();

	guest.close();
	expect(await host.next()).toEqual({ t: 'peer', event: 'left' });

	host.close();
});

test('a code is reusable once its room empties', async () => {
	const host = await new Peer().open();
	host.send({ t: 'create' });

	const created = await host.next();
	if (created.t !== 'created') throw new Error('expected a code');

	host.close();
	await Bun.sleep(60);

	const late = await new Peer().open();
	late.send({ t: 'join', code: created.code });

	expect((await late.next()).t).toBe('error');
	late.close();
});
