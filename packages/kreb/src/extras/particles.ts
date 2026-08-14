import type { Texture } from '@kreb/raylib-sys';
import { Node2D } from '../core/node-2d.ts';
import { Node3D } from '../core/node-3d.ts';
import type { Draw2D, Draw3D } from '../draw/context.ts';
import { lerp, lerpColor } from './ease.ts';

export type Range = { min: number; max: number };

export type ParticleOptions = {
	maxParticles?: number;
	/** Particles emitted per second while the emitter is running. */
	rate?: number;
	lifetime?: Range;
	speed?: Range;
	size?: { start: number; end: number };
	color?: { start: number; end: number };
	gravity?: number[];
	/** Half-angle of the emission cone, in radians. */
	spread?: number;
	/** Direction the cone points. Angle in 2D, unit vector in 3D. */
	direction?: number;
	random?: () => number;
};

export type Particle = {
	position: number[];
	velocity: number[];
	age: number;
	lifetime: number;
	alive: boolean;
};

const DEFAULTS = {
	maxParticles: 256,
	rate: 60,
	lifetime: { min: 0.4, max: 1 },
	speed: { min: 60, max: 140 },
	size: { start: 6, end: 0 },
	color: { start: 0xffffffff, end: 0xffffff00 },
	spread: Math.PI,
	direction: -Math.PI / 2,
};

/**
 * A fixed pool shared by the 2D and 3D emitters: particles are plain coordinate
 * arrays, so the simulation is written once. Dead slots are reused rather than
 * reallocated, which keeps a long-running emitter from churning the heap.
 */
export class ParticleSystem {
	readonly particles: Particle[] = [];
	readonly dimensions: number;

	options: Required<Omit<ParticleOptions, 'gravity' | 'random'>> & {
		gravity: number[];
		random: () => number;
	};

	#emitting = true;
	#carry = 0;

	constructor(dimensions: 2 | 3, options: ParticleOptions = {}) {
		this.dimensions = dimensions;
		this.options = {
			...DEFAULTS,
			gravity: new Array(dimensions).fill(0),
			random: Math.random,
			...options,
		};

		for (let i = 0; i < this.options.maxParticles; i += 1) {
			this.particles.push({
				position: new Array(dimensions).fill(0),
				velocity: new Array(dimensions).fill(0),
				age: 0,
				lifetime: 1,
				alive: false,
			});
		}
	}

	get alive(): number {
		return this.particles.reduce((total, particle) => total + (particle.alive ? 1 : 0), 0);
	}

	get emitting(): boolean {
		return this.#emitting;
	}

	start(): void {
		this.#emitting = true;
	}

	stop(): void {
		this.#emitting = false;
	}

	clear(): void {
		for (const particle of this.particles) particle.alive = false;
	}

	burst(count: number, origin: number[]): void {
		for (let i = 0; i < count; i += 1) this.#spawn(origin);
	}

	update(dt: number, origin: number[]): void {
		if (this.#emitting && this.options.rate > 0) {
			this.#carry += dt * this.options.rate;

			while (this.#carry >= 1) {
				this.#carry -= 1;
				this.#spawn(origin);
			}
		}

		const { gravity } = this.options;

		for (const particle of this.particles) {
			if (!particle.alive) continue;

			particle.age += dt;
			if (particle.age >= particle.lifetime) {
				particle.alive = false;
				continue;
			}

			for (let i = 0; i < this.dimensions; i += 1) {
				particle.velocity[i] = (particle.velocity[i] as number) + (gravity[i] as number) * dt;
				particle.position[i] =
					(particle.position[i] as number) + (particle.velocity[i] as number) * dt;
			}
		}
	}

	/** 0 at birth, 1 at death. */
	progress(particle: Particle): number {
		return Math.min(particle.age / particle.lifetime, 1);
	}

	sizeOf(particle: Particle): number {
		return lerp(this.options.size.start, this.options.size.end, this.progress(particle));
	}

	colorOf(particle: Particle): number {
		return lerpColor(this.options.color.start, this.options.color.end, this.progress(particle));
	}

	#spawn(origin: number[]): void {
		const particle = this.particles.find((candidate) => !candidate.alive);

		// A full pool drops the emission rather than growing without bound.
		if (!particle) return;

		const { random, lifetime, speed, spread, direction } = this.options;

		particle.alive = true;
		particle.age = 0;
		particle.lifetime = lerp(lifetime.min, lifetime.max, random());

		for (let i = 0; i < this.dimensions; i += 1) particle.position[i] = origin[i] as number;

		const magnitude = lerp(speed.min, speed.max, random());
		const angle = direction + (random() * 2 - 1) * spread;

		particle.velocity[0] = Math.cos(angle) * magnitude;
		particle.velocity[1] = Math.sin(angle) * magnitude;

		if (this.dimensions === 3) {
			const tilt = (random() * 2 - 1) * spread;
			particle.velocity[2] = Math.sin(tilt) * magnitude;
		}
	}
}

export class ParticleEmitter2D extends Node2D {
	readonly system: ParticleSystem;

	constructor(options: ParticleOptions = {}, name?: string) {
		super(name);
		this.system = new ParticleSystem(2, options);
	}

	override update(dt: number): void {
		const { position } = this.global;
		this.system.update(dt, [position.x, position.y]);
	}

	burst(count: number): void {
		const { position } = this.global;
		this.system.burst(count, [position.x, position.y]);
	}

	override draw(g: Draw2D): void {
		const { position } = this.global;

		for (const particle of this.system.particles) {
			if (!particle.alive) continue;

			// Particles live in world space; draw contexts take node-local
			// coordinates, so the emitter's own offset comes back out here.
			g.circle(
				{
					x: (particle.position[0] as number) - position.x,
					y: (particle.position[1] as number) - position.y,
				},
				this.system.sizeOf(particle),
				{ color: this.system.colorOf(particle) },
			);
		}
	}
}

export class ParticleEmitter3D extends Node3D {
	readonly system: ParticleSystem;

	texture: Texture | null = null;

	constructor(options: ParticleOptions = {}, name?: string) {
		super(name);
		this.system = new ParticleSystem(3, options);
	}

	override update(dt: number): void {
		const p = this.globalPosition;
		this.system.update(dt, [p.x, p.y, p.z]);
	}

	burst(count: number): void {
		const p = this.globalPosition;
		this.system.burst(count, [p.x, p.y, p.z]);
	}

	override draw(g: Draw3D): void {
		const origin = this.globalPosition;

		for (const particle of this.system.particles) {
			if (!particle.alive) continue;

			const offset = {
				x: (particle.position[0] as number) - origin.x,
				y: (particle.position[1] as number) - origin.y,
				z: (particle.position[2] as number) - origin.z,
			};

			const color = this.system.colorOf(particle);
			const size = this.system.sizeOf(particle);

			// A texture gives real camera-facing billboards; without one there is
			// nothing to billboard, so the particle falls back to a small sphere.
			if (this.texture) g.billboard(this.texture, offset, size, { tint: color });
			else g.line(offset, { x: offset.x, y: offset.y + size, z: offset.z }, { color });
		}
	}
}
