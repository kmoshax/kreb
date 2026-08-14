import { expect, test } from 'bun:test';
import { Ease, lerpColor } from 'kreb/extras/ease';
import { fsm } from 'kreb/extras/fsm';
import { ParticleSystem } from 'kreb/extras/particles';
import { Timer } from 'kreb/extras/timer';
import { TweenRunner } from 'kreb/extras/tween';

/** Deterministic stand-in for Math.random so particle tests are repeatable. */
function sequence(values: number[]): () => number {
	let index = 0;
	return () => values[index++ % values.length] as number;
}

test('easings start at zero and end at one', () => {
	for (const [name, ease] of Object.entries(Ease)) {
		expect(ease(0), name).toBeCloseTo(0, 5);
		expect(ease(1), name).toBeCloseTo(1, 5);
	}
});

test('colors interpolate per channel, alpha included', () => {
	expect(lerpColor(0x000000ff, 0xffffffff, 0)).toBe(0x000000ff);
	expect(lerpColor(0x000000ff, 0xffffffff, 1)).toBe(0xffffffff);
	expect(lerpColor(0x00000000, 0x000000ff, 0.5)).toBe(0x00000080);
});

test('a tween drives its callback and finishes exactly on the end value', () => {
	const runner = new TweenRunner();
	const seen: number[] = [];

	runner.run(1, Ease.Linear, (t) => seen.push(t));

	runner.update(0.5);
	expect(seen.at(-1)).toBeCloseTo(0.5, 6);

	// Overshooting the duration still lands on 1, not 1.5.
	runner.update(1);
	expect(seen.at(-1)).toBe(1);
	expect(runner.active).toBe(0);
});

test('onDone fires once when the tween completes', () => {
	const runner = new TweenRunner();

	let completions = 0;
	runner
		.run(1, Ease.Linear, () => {})
		.onDone(() => {
			completions += 1;
		});

	runner.update(2);
	runner.update(2);

	expect(completions).toBe(1);
});

test('a delayed tween waits, then uses the overflow', () => {
	const runner = new TweenRunner();
	const seen: number[] = [];

	runner.run(1, Ease.Linear, (t) => seen.push(t), { delay: 0.5 });

	runner.update(0.25);
	expect(seen).toEqual([]);

	// 0.5 consumed by the delay, 0.25 spent on the tween itself.
	runner.update(0.5);
	expect(seen.at(-1)).toBeCloseTo(0.25, 6);
});

test('a repeating tween runs the requested number of extra passes', () => {
	const runner = new TweenRunner();

	let completions = 0;
	runner
		.run(1, Ease.Linear, () => {}, { repeat: 2 })
		.onDone(() => {
			completions += 1;
		});

	runner.update(1.5);
	expect(runner.active).toBe(1);

	runner.update(1);
	expect(runner.active).toBe(1);

	runner.update(1);
	expect(completions).toBe(1);
	expect(runner.active).toBe(0);
});

test('a ping-pong tween comes back to the start', () => {
	const runner = new TweenRunner();
	const seen: number[] = [];

	runner.run(1, Ease.Linear, (t) => seen.push(t), { pingPong: true });

	runner.update(0.5);
	expect(seen.at(-1)).toBeCloseTo(0.5, 6);

	runner.update(1);
	expect(seen.at(-1)).toBeCloseTo(0.5, 6);

	runner.update(1);
	expect(seen.at(-1)).toBe(0);
});

test('a cancelled tween stops applying and leaves the runner', () => {
	const runner = new TweenRunner();
	const seen: number[] = [];

	const tween = runner.run(1, Ease.Linear, (t) => seen.push(t));
	runner.update(0.25);
	tween.cancel();
	runner.update(0.25);

	expect(seen.length).toBe(1);
	expect(runner.active).toBe(0);
});

test('to() interpolates between two numbers', () => {
	const runner = new TweenRunner();

	let value = 0;
	runner.to(1, 10, 20, (next) => {
		value = next;
	});

	runner.update(0.5);
	expect(value).toBeCloseTo(15, 6);
});

test('a tween refuses a non-positive duration', () => {
	expect(() => new TweenRunner().run(0, Ease.Linear, () => {})).toThrow('must be positive');
});

test('a one-shot timer completes once and stops', () => {
	const timer = new Timer(1);

	expect(timer.update(0.5)).toBe(0);
	expect(timer.progress).toBeCloseTo(0.5, 6);

	expect(timer.update(0.6)).toBe(1);
	expect(timer.finished).toBe(true);
	expect(timer.running).toBe(false);

	expect(timer.update(5)).toBe(0);
});

test('a repeating timer reports every period a long frame spans', () => {
	const timer = new Timer(1, { repeat: true });

	expect(timer.update(3.5)).toBe(3);
	expect(timer.elapsed).toBeCloseTo(0.5, 6);
	expect(timer.finished).toBe(false);
});

test('a stopped timer does not advance, and restart clears it', () => {
	const timer = new Timer(1, { autoStart: false });

	expect(timer.update(2)).toBe(0);
	expect(timer.elapsed).toBe(0);

	timer.start();
	timer.update(0.5);
	timer.restart();

	expect(timer.elapsed).toBe(0);
	expect(timer.running).toBe(true);
});

test('a timer refuses a non-positive duration', () => {
	expect(() => new Timer(0)).toThrow('must be positive');
});

const Machine = {
	idle: { jump: 'airborne', run: 'running' },
	running: { jump: 'airborne', stop: 'idle' },
	airborne: { land: 'idle' },
} as const;

test('a state machine starts at the first state and transitions on events', () => {
	const state = fsm(Machine);

	expect(state.current).toBe('idle');
	expect(state.is('idle')).toBe(true);

	const moved = state.send('jump');
	expect(moved).toEqual({ from: 'idle', to: 'airborne', event: 'jump' });
	expect(state.current).toBe('airborne');
});

test('an event the current state does not handle is refused, not thrown', () => {
	const state = fsm(Machine);

	expect(state.can('land')).toBe(false);
	expect(state.send('land')).toBeNull();
	expect(state.current).toBe('idle');
});

test('enter and exit listeners fire with the other side of the transition', () => {
	const state = fsm(Machine);
	const log: string[] = [];

	state.onExit('idle', (to) => log.push(`exit idle -> ${to}`));
	state.onEnter('airborne', (from) => log.push(`enter airborne <- ${from}`));

	state.send('jump');

	expect(log).toEqual(['exit idle -> airborne', 'enter airborne <- idle']);
});

test('a machine can start somewhere other than the first state', () => {
	expect(fsm(Machine, 'running').current).toBe('running');
	expect(() => fsm(Machine, 'nowhere' as 'idle')).toThrow('Unknown initial state');
});

test('reset returns to the initial state', () => {
	const state = fsm(Machine, 'idle');

	state.send('jump');
	state.reset();

	expect(state.current).toBe('idle');
});

test('particles spawn at the emitter origin and expire', () => {
	const system = new ParticleSystem(2, {
		rate: 10,
		lifetime: { min: 1, max: 1 },
		speed: { min: 0, max: 0 },
		random: sequence([0.5]),
	});

	system.update(0.5, [100, 50]);
	expect(system.alive).toBe(5);

	const first = system.particles.find((p) => p.alive);
	expect(first?.position).toEqual([100, 50]);

	system.update(1.01, [100, 50]);
	expect(system.alive).toBeLessThan(15);
});

test('gravity accelerates a particle', () => {
	const system = new ParticleSystem(2, {
		rate: 0,
		lifetime: { min: 10, max: 10 },
		speed: { min: 0, max: 0 },
		gravity: [0, 100],
		random: sequence([0.5]),
	});

	system.burst(1, [0, 0]);
	system.update(1, [0, 0]);

	const particle = system.particles.find((p) => p.alive);
	expect(particle?.velocity[1]).toBeCloseTo(100, 5);
	expect(particle?.position[1]).toBeCloseTo(100, 5);
});

test('the pool is fixed: a full emitter drops rather than growing', () => {
	const system = new ParticleSystem(2, {
		maxParticles: 4,
		rate: 0,
		lifetime: { min: 10, max: 10 },
		random: sequence([0.5]),
	});

	system.burst(100, [0, 0]);

	expect(system.particles.length).toBe(4);
	expect(system.alive).toBe(4);
});

test('dead slots are reused instead of allocating', () => {
	const system = new ParticleSystem(2, {
		maxParticles: 2,
		rate: 0,
		lifetime: { min: 1, max: 1 },
		random: sequence([0.5]),
	});

	system.burst(2, [0, 0]);
	system.update(1.5, [0, 0]);
	expect(system.alive).toBe(0);

	system.burst(2, [5, 5]);
	expect(system.alive).toBe(2);
	expect(system.particles.length).toBe(2);
});

test('size and color follow the particle lifetime', () => {
	const system = new ParticleSystem(2, {
		rate: 0,
		lifetime: { min: 2, max: 2 },
		size: { start: 10, end: 0 },
		color: { start: 0xffffffff, end: 0xffffff00 },
		random: sequence([0.5]),
	});

	system.burst(1, [0, 0]);
	const particle = system.particles[0];
	if (!particle) throw new Error('no particle');

	expect(system.sizeOf(particle)).toBeCloseTo(10, 5);

	system.update(1, [0, 0]);
	expect(system.sizeOf(particle)).toBeCloseTo(5, 5);
	expect(system.colorOf(particle)).toBe(0xffffff80);
});

test('stopping an emitter halts spawning but keeps live particles', () => {
	const system = new ParticleSystem(3, {
		rate: 10,
		lifetime: { min: 10, max: 10 },
		random: sequence([0.5]),
	});

	system.update(1, [0, 0, 0]);
	const before = system.alive;
	expect(before).toBeGreaterThan(0);

	system.stop();
	system.update(1, [0, 0, 0]);

	expect(system.emitting).toBe(false);
	expect(system.alive).toBe(before);
});
