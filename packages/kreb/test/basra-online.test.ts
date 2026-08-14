// A whole online match, host against guest, over the real relay. The rules are
// tested elsewhere; what this proves is that the two screens stay in agreement.

import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Subprocess } from 'bun';
import { GuestController, HostController } from '../examples/basra/controllers.ts';
import { Net } from '../examples/basra/net.ts';

const PORT = 7913;
const SERVER = new URL('../examples/basra/server.ts', import.meta.url).pathname;
const STEP = 1 / 60;

let server: Subprocess;

async function settle(steps = 40): Promise<void> {
	for (let i = 0; i < steps; i += 1) await Bun.sleep(1);
}

beforeAll(async () => {
	server = Bun.spawn(['bun', SERVER, String(PORT)], { stdout: 'ignore', stderr: 'pipe' });
	await Bun.sleep(300);
});

afterAll(() => {
	server.kill();
});

async function pair() {
	const hostNet = new Net(`ws://localhost:${PORT}`);
	const guestNet = new Net(`ws://localhost:${PORT}`);

	hostNet.connect();
	guestNet.connect();
	await settle();

	hostNet.create();
	await settle();

	const code = hostNet.code;
	if (!code) throw new Error('no room code');

	guestNet.join(code);
	await settle();

	// The lobby consumes the peer-joined event before handing over.
	hostNet.drain();

	return { host: new HostController(hostNet), guest: new GuestController(guestNet), code };
}

test('the guest sees the table only after the host publishes it', async () => {
	const { host, guest } = await pair();

	expect(guest.view).toBeNull();
	expect(guest.blocked).toContain('Waiting');

	host.update(STEP);
	await settle();
	guest.update(STEP);

	expect(guest.view).not.toBeNull();
	expect(guest.view?.seat).toBe('b');
	expect(guest.view?.hand.length).toBe(4);

	host.leave();
	guest.leave();
});

test('a guest move reaches the host and comes back as new state', async () => {
	const { host, guest } = await pair();

	host.update(STEP);
	await settle();
	guest.update(STEP);

	// Seat a opens, so the host plays first.
	const opening = host.view.hand[0];
	if (!opening) throw new Error('no card to play');
	host.play(opening);

	await settle();
	guest.update(STEP);
	expect(guest.view?.turn).toBe('b');

	const reply = guest.view?.hand[0];
	if (!reply) throw new Error('no card to reply with');
	guest.play(reply);

	await settle();
	host.update(STEP);
	expect(host.view.turn).toBe('a');

	host.leave();
	guest.leave();
});

test('an out-of-turn move from the guest is ignored by the host', async () => {
	const { host, guest } = await pair();

	host.update(STEP);
	await settle();
	guest.update(STEP);

	const before = host.view.turn;
	const card = guest.view?.hand[0];
	if (!card) throw new Error('no card');

	// It is seat a's turn, so this must change nothing.
	guest.play(card);
	await settle();
	host.update(STEP);

	expect(host.view.turn).toBe(before);
	expect(host.view.lastMove).toBeNull();

	host.leave();
	guest.leave();
});

test('a full match finishes with both sides agreeing', async () => {
	const { host, guest } = await pair();

	for (let frame = 0; frame < 3000; frame += 1) {
		host.update(STEP);
		guest.update(STEP);

		const hv = host.view;
		if (!hv.finished && hv.turn === 'a' && hv.hand[0]) host.play(hv.hand[0]);

		const gv = guest.view;
		if (gv && !gv.finished && gv.turn === 'b' && gv.hand[0]) guest.play(gv.hand[0]);

		if (hv.finished && guest.view?.finished) break;
		await Bun.sleep(1);
	}

	const hv = host.view;
	const gv = guest.view;

	expect(hv.finished).toBe(true);
	expect(gv?.finished).toBe(true);

	// Same match, two screens: the numbers have to match.
	expect(gv?.scores).toEqual(hv.scores);
	expect(gv?.taken).toEqual(hv.taken);
	expect(hv.taken.a + hv.taken.b).toBe(52);

	host.leave();
	guest.leave();
}, 30_000);

test('the guest is told when the host disappears', async () => {
	const { host, guest } = await pair();

	host.update(STEP);
	await settle();
	guest.update(STEP);
	expect(guest.blocked).toBeNull();

	host.leave();
	await settle();
	guest.update(STEP);

	expect(guest.blocked).toContain('host left');

	guest.leave();
});
