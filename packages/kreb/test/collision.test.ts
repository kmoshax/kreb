import { expect, test } from 'bun:test';
import {
	BoxCollider2D,
	BoxCollider3D,
	CircleCollider2D,
	type Collider,
	SphereCollider3D,
} from '../src/collision/collider.ts';
import { interested, layer, layers } from '../src/collision/layers.ts';
import { SpatialHash } from '../src/collision/spatial-hash.ts';
import { overlaps, rayBox, raySphere } from '../src/collision/volume.ts';
import { CollisionWorld } from '../src/collision/world.ts';
import { Node2D } from '../src/core/node-2d.ts';
import { Node3D } from '../src/core/node-3d.ts';

const Layer = {
	Player: layer(0),
	Hazard: layer(1),
	Wall: layer(2),
};

class Recorder extends BoxCollider2D {
	readonly entered: string[] = [];
	readonly exited: string[] = [];

	override onEnter(other: Collider): void {
		this.entered.push(other.name);
	}

	override onExit(other: Collider): void {
		this.exited.push(other.name);
	}
}

test('layer indices become single bits and combine into masks', () => {
	expect(layer(0)).toBe(1);
	expect(layer(3)).toBe(8);
	expect(layers(layer(0), layer(2))).toBe(5);

	expect(() => layer(32)).toThrow('0..31');
	expect(() => layer(-1)).toThrow('0..31');
});

test('either side being interested is enough to report a pair', () => {
	expect(interested(Layer.Player, 0, Layer.Hazard, Layer.Player)).toBe(true);
	expect(interested(Layer.Player, Layer.Hazard, Layer.Hazard, 0)).toBe(true);
	expect(interested(Layer.Player, 0, Layer.Hazard, 0)).toBe(false);
});

test('box and sphere overlap tests work in both dimensions', () => {
	const box2 = { kind: 'box', center: [0, 0], half: [1, 1] } as const;
	const box2Far = { kind: 'box', center: [3, 0], half: [1, 1] } as const;
	const circle = { kind: 'sphere', center: [1.5, 0], radius: 0.6 } as const;

	expect(overlaps(box2, box2Far)).toBe(false);
	expect(overlaps(box2, circle)).toBe(true);
	expect(overlaps(circle, box2)).toBe(true);

	const box3 = { kind: 'box', center: [0, 0, 0], half: [1, 1, 1] } as const;
	const sphere3 = { kind: 'sphere', center: [0, 0, 1.5], radius: 0.6 } as const;

	expect(overlaps(box3, sphere3)).toBe(true);
});

test('a ray reports distance, point and the face it entered', () => {
	const box = { kind: 'box', center: [5, 0], half: [1, 1] } as const;
	const result = rayBox([0, 0], [1, 0], box, 100);

	if (!result.hit) throw new Error('expected a hit');

	expect(result.distance).toBeCloseTo(4, 6);
	expect(result.point[0]).toBeCloseTo(4, 6);
	expect(result.normal).toEqual([-1, 0]);
});

test('a ray pointing away misses, and range is respected', () => {
	const box = { kind: 'box', center: [5, 0], half: [1, 1] } as const;

	expect(rayBox([0, 0], [-1, 0], box, 100).hit).toBe(false);
	expect(rayBox([0, 0], [1, 0], box, 2).hit).toBe(false);
});

test('a ray starting inside a sphere hits at the exit', () => {
	const sphere = { kind: 'sphere', center: [0, 0, 0], radius: 2 } as const;
	const result = raySphere([0, 0, 0], [1, 0, 0], sphere, 100);

	if (!result.hit) throw new Error('expected a hit');
	expect(result.distance).toBeCloseTo(2, 6);
});

test('the spatial hash only returns things sharing a cell', () => {
	const hash = new SpatialHash<string>(10);

	hash.insert('near', { min: [0, 0], max: [1, 1] });
	hash.insert('alsoNear', { min: [2, 2], max: [3, 3] });
	hash.insert('far', { min: [500, 500], max: [501, 501] });

	const candidates = hash.candidates({ min: [0, 0], max: [1, 1] }, 'near');

	expect(candidates).toEqual(['alsoNear']);
	expect(hash.size).toBe(3);
});

test('a large item spans cells and is returned once', () => {
	const hash = new SpatialHash<string>(10);

	hash.insert('wide', { min: [0, 0], max: [95, 5] });

	const candidates = hash.candidates({ min: [90, 0], max: [91, 1] });
	expect(candidates).toEqual(['wide']);
});

test('the hash refuses a non-positive cell size', () => {
	expect(() => new SpatialHash(0)).toThrow('must be positive');
});

test('onEnter fires once when contact begins, onExit when it ends', () => {
	const root = new Node2D('root');
	const player = new Recorder({ x: 10, y: 10 }, { layer: Layer.Player }, 'player');
	const hazard = new BoxCollider2D({ x: 10, y: 10 }, { layer: Layer.Hazard }, 'hazard');

	root.add(player);
	root.add(hazard);
	hazard.position.set({ x: 100, y: 0 });

	const world = new CollisionWorld();

	world.collect(root);
	world.step();
	expect(player.entered).toEqual([]);

	hazard.position.set({ x: 5, y: 0 });
	world.collect(root);
	world.step();
	expect(player.entered).toEqual(['hazard']);

	// Still touching: no repeat.
	world.collect(root);
	world.step();
	expect(player.entered).toEqual(['hazard']);

	hazard.position.set({ x: 100, y: 0 });
	world.collect(root);
	world.step();
	expect(player.exited).toEqual(['hazard']);
});

test('masks suppress callbacks for uninterested pairs', () => {
	const root = new Node2D('root');
	const player = new Recorder(
		{ x: 10, y: 10 },
		{ layer: Layer.Player, mask: Layer.Wall },
		'player',
	);
	const hazard = new BoxCollider2D({ x: 10, y: 10 }, { layer: Layer.Hazard, mask: 0 }, 'hazard');

	root.add(player);
	root.add(hazard);

	const world = new CollisionWorld();
	world.collect(root);
	world.step();

	expect(player.entered).toEqual([]);
});

test('a collider inherits its parent transform', () => {
	const parent = new Node2D('parent');
	const box = new BoxCollider2D({ x: 2, y: 2 }, {}, 'box');
	parent.add(box);

	parent.position.set({ x: 50, y: 0 });
	expect(box.volume.center).toEqual([50, 0]);

	parent.scale.set({ x: 3, y: 3 });
	const volume = box.volume;
	if (volume.kind !== 'box') throw new Error('expected a box');

	expect(volume.half).toEqual([3, 3]);
});

test('a 3D collider picks up scale from the world matrix', () => {
	const parent = new Node3D('parent');
	const sphere = new SphereCollider3D(1, {}, 'sphere');
	parent.add(sphere);

	parent.scale.set({ x: 2, y: 2, z: 2 });
	const volume = sphere.volume;
	if (volume.kind !== 'sphere') throw new Error('expected a sphere');

	expect(volume.radius).toBeCloseTo(2, 5);
});

test('overlap queries return an empty array, never null', () => {
	const root = new Node2D('root');
	const lonely = new CircleCollider2D(5, {}, 'lonely');
	root.add(lonely);

	const world = new CollisionWorld();
	world.collect(root);

	expect(world.overlapping(lonely)).toEqual([]);
});

test('overlapVolume finds colliders under a free-standing shape', () => {
	const root = new Node2D('root');
	const target = new CircleCollider2D(5, { layer: Layer.Hazard }, 'target');
	root.add(target);
	target.position.set({ x: 20, y: 0 });

	const world = new CollisionWorld();
	world.collect(root);

	const hits = world.overlapVolume({ kind: 'box', center: [18, 0], half: [4, 4] });
	expect(hits.map((h) => h.collider.name)).toEqual(['target']);

	expect(world.overlapVolume({ kind: 'box', center: [18, 0], half: [4, 4] }, Layer.Wall)).toEqual(
		[],
	);
});

test('raycast returns the nearest hit and narrows on a discriminant', () => {
	const root = new Node2D('root');
	const near = new BoxCollider2D({ x: 2, y: 2 }, {}, 'near');
	const far = new BoxCollider2D({ x: 2, y: 2 }, {}, 'far');

	root.add(near);
	root.add(far);
	near.position.set({ x: 10, y: 0 });
	far.position.set({ x: 30, y: 0 });

	const world = new CollisionWorld();
	world.collect(root);

	const hit = world.raycast([0, 0], [1, 0]);
	if (!hit.hit) throw new Error('expected a hit');

	expect(hit.collider.name).toBe('near');
	expect(hit.distance).toBeCloseTo(9, 5);
});

test('raycast misses report hit false rather than null', () => {
	const world = new CollisionWorld();
	world.collect(new Node2D('empty'));

	const result = world.raycast([0, 0], [1, 0]);
	expect(result).toEqual({ hit: false });

	// A zero-length direction has no ray to cast.
	expect(world.raycast([0, 0], [0, 0]).hit).toBe(false);
});

test('a mask filters what a ray can hit', () => {
	const root = new Node2D('root');
	const wall = new BoxCollider2D({ x: 2, y: 2 }, { layer: Layer.Wall }, 'wall');
	root.add(wall);
	wall.position.set({ x: 10, y: 0 });

	const world = new CollisionWorld();
	world.collect(root);

	expect(world.raycast([0, 0], [1, 0], { mask: Layer.Wall }).hit).toBe(true);
	expect(world.raycast([0, 0], [1, 0], { mask: Layer.Player }).hit).toBe(false);
});

test('2D and 3D colliders never collide with each other', () => {
	const root = new Node3D('root');
	const flat = new BoxCollider2D({ x: 10, y: 10 }, {}, 'flat');
	const solid = new BoxCollider3D({ x: 10, y: 10, z: 10 }, {}, 'solid');

	root.add(flat);
	root.add(solid);

	const world = new CollisionWorld();
	world.collect(root);
	world.step();

	expect(world.size).toBe(2);
	expect(world.overlapping(solid)).toEqual([]);
	expect(world.raycast([0, 0, 0], [1, 0, 0]).hit).toBe(true);
});

test('destroyed colliders leave the world', () => {
	const root = new Node2D('root');
	const box = new BoxCollider2D({ x: 4, y: 4 }, {}, 'box');
	root.add(box);

	const world = new CollisionWorld();
	world.collect(root);
	expect(world.size).toBe(1);

	box.destroy();
	world.collect(root);
	expect(world.size).toBe(0);
});
