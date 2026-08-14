import { expect, test } from 'bun:test';
import { Vector3Transform } from '@kreb/math';
import { Loop } from 'kreb/core/loop';
import { Node } from 'kreb/core/node';
import { Node2D } from 'kreb/core/node-2d';
import { Node3D } from 'kreb/core/node-3d';
import { Anchor, NodeUI } from 'kreb/core/node-ui';
import { RenderQueue } from 'kreb/core/render-queue';

class Bare extends Node {}

test('a child is parented and reachable, and reparenting detaches cleanly', () => {
	const root = new Bare('root');
	const a = new Bare('a');
	const b = new Bare('b');

	root.add(a);
	a.add(b);

	expect(root.children).toEqual([a]);
	expect(b.parent).toBe(a);

	root.add(b);
	expect(a.children).toEqual([]);
	expect(b.parent).toBe(root);
});

test('cycles are refused with a message naming both nodes', () => {
	const root = new Bare('root');
	const child = new Bare('child');
	root.add(child);

	expect(() => child.add(root)).toThrow('Cannot add "root" to its own descendant "child"');
	expect(() => root.add(root)).toThrow('itself');
});

test('ready fires once on entering the tree, for descendants too', () => {
	const fired: string[] = [];

	class Tracked extends Node {
		override ready(): void {
			fired.push(this.name);
		}
	}

	const root = new Tracked('root');
	const child = new Tracked('child');
	root.add(child);

	root.enterTree();
	expect(fired).toEqual(['root', 'child']);

	root.enterTree();
	expect(fired).toEqual(['root', 'child']);
});

test('a node added to a live tree enters it immediately', () => {
	const fired: string[] = [];

	class Tracked extends Node {
		override ready(): void {
			fired.push(this.name);
		}
	}

	const root = new Tracked('root');
	root.enterTree();

	root.add(new Tracked('late'));
	expect(fired).toEqual(['root', 'late']);
});

test('destroy is recursive and detaches from the parent', () => {
	const root = new Bare('root');
	const child = new Bare('child');
	const grandchild = new Bare('grandchild');

	root.add(child);
	child.add(grandchild);
	child.destroy();

	expect(child.destroyed).toBe(true);
	expect(grandchild.destroyed).toBe(true);
	expect(root.children).toEqual([]);
});

test('2D world transform composes position, rotation and scale', () => {
	const parent = new Node2D('parent');
	const child = new Node2D('child');
	parent.add(child);

	parent.position.set({ x: 10, y: 5 });
	parent.scale.set({ x: 2, y: 2 });
	child.position.set({ x: 3, y: 0 });

	expect(child.global.position.x).toBeCloseTo(16, 6);
	expect(child.global.position.y).toBeCloseTo(5, 6);
	expect(child.global.scale.x).toBeCloseTo(2, 6);
});

test('2D parent rotation rotates the child offset', () => {
	const parent = new Node2D('parent');
	const child = new Node2D('child');
	parent.add(child);

	parent.rotation = Math.PI / 2;
	child.position.set({ x: 1, y: 0 });

	expect(child.global.position.x).toBeCloseTo(0, 5);
	expect(child.global.position.y).toBeCloseTo(1, 5);
	expect(child.global.rotation).toBeCloseTo(Math.PI / 2, 6);
});

test('mutating a single component invalidates the cached transform', () => {
	const parent = new Node2D('parent');
	const child = new Node2D('child');
	parent.add(child);

	child.position.set({ x: 1, y: 1 });
	expect(child.global.position.x).toBeCloseTo(1, 6);

	// A plain object field would make this write invisible to the cache.
	parent.position.x = 100;
	expect(child.global.position.x).toBeCloseTo(101, 6);
});

test('reparenting invalidates the cached transform', () => {
	const a = new Node2D('a');
	const b = new Node2D('b');
	const child = new Node2D('child');

	a.position.set({ x: 10, y: 0 });
	b.position.set({ x: -10, y: 0 });

	a.add(child);
	expect(child.global.position.x).toBeCloseTo(10, 6);

	b.add(child);
	expect(child.global.position.x).toBeCloseTo(-10, 6);
});

test('3D world transform nests through the matrix', () => {
	const parent = new Node3D('parent');
	const child = new Node3D('child');
	parent.add(child);

	parent.position.set({ x: 0, y: 10, z: 0 });
	child.position.set({ x: 5, y: 0, z: 0 });

	const origin = Vector3Transform({ x: 0, y: 0, z: 0 }, child.globalTransform);

	expect(origin.x).toBeCloseTo(5, 5);
	expect(origin.y).toBeCloseTo(10, 5);
	expect(child.globalPosition.y).toBeCloseTo(10, 5);
});

test('3D scale applies before the parent translation', () => {
	const parent = new Node3D('parent');
	const child = new Node3D('child');
	parent.add(child);

	parent.position.set({ x: 100, y: 0, z: 0 });
	child.scale.set({ x: 3, y: 3, z: 3 });

	const corner = Vector3Transform({ x: 1, y: 0, z: 0 }, child.globalTransform);
	expect(corner.x).toBeCloseTo(103, 5);
});

test('a Node2D under a Node3D still composes against its nearest 2D ancestor', () => {
	const flat = new Node2D('flat');
	const spatial = new Node3D('spatial');
	const nested = new Node2D('nested');

	flat.position.set({ x: 7, y: 0 });
	flat.add(spatial);
	spatial.add(nested);
	nested.position.set({ x: 1, y: 0 });

	expect(nested.global.position.x).toBeCloseTo(8, 6);
});

test('the render queue buckets by node type, not by ancestry', () => {
	const root = new Node3D('root');
	const flat = new Node2D('flat');
	const hud = new NodeUI('hud');

	root.add(flat);
	flat.add(hud);

	const queue = new RenderQueue();
	queue.collect(root);

	expect(queue.world3d).toEqual([root]);
	expect(queue.world2d).toEqual([flat]);
	expect(queue.ui).toEqual([hud]);
});

test('2D and UI buckets sort by zIndex', () => {
	const back = new Node2D('back');
	const front = new Node2D('front');

	back.zIndex = 5;
	front.zIndex = 1;

	const holder = new Node2D('holder');
	holder.add(back);
	holder.add(front);

	const queue = new RenderQueue();
	queue.collect(holder);
	queue.sort(null);

	expect(queue.world2d.map((n) => n.name)).toEqual(['holder', 'front', 'back']);
});

test('3D bucket sorts front to back from the eye', () => {
	const root = new Node3D('root');
	const near = new Node3D('near');
	const far = new Node3D('far');

	near.position.set({ x: 0, y: 0, z: 1 });
	far.position.set({ x: 0, y: 0, z: 50 });
	root.add(far);
	root.add(near);

	const queue = new RenderQueue();
	queue.collect(root);
	queue.sort({ x: 0, y: 0, z: 0 });

	expect(queue.world3d.map((n) => n.name)).toEqual(['root', 'near', 'far']);
});

test('destroyed nodes are not collected', () => {
	const root = new Node2D('root');
	const child = new Node2D('child');
	root.add(child);
	child.destroy();

	const queue = new RenderQueue();
	queue.collect(root);

	expect(queue.world2d).toEqual([root]);
});

test('UI anchors resolve against the viewport', () => {
	const hud = new NodeUI('hud');
	hud.anchor = Anchor.BottomRight;
	hud.offset = { x: -10, y: -20, width: 100, height: 30 };

	const rect = hud.resolve({ x: 0, y: 0, width: 800, height: 600 });

	expect(rect.x).toBe(790);
	expect(rect.y).toBe(580);
});

test('nested UI anchors resolve against the parent rect', () => {
	const panel = new NodeUI('panel');
	panel.anchor = Anchor.TopLeft;
	panel.offset = { x: 100, y: 50, width: 200, height: 100 };

	const label = new NodeUI('label');
	label.anchor = Anchor.Center;
	label.offset = { x: 0, y: 0, width: 10, height: 10 };
	panel.add(label);

	const rect = label.resolve({ x: 0, y: 0, width: 800, height: 600 });

	expect(rect.x).toBe(200);
	expect(rect.y).toBe(100);
});

test('the loop runs whole fixed steps and keeps the remainder', () => {
	const loop = new Loop({ stepsPerSecond: 60 });

	expect(loop.advance(1 / 60)).toBe(1);
	expect(loop.advance(0)).toBe(0);
	expect(loop.advance(1 / 30)).toBe(2);
});

test('the loop clamps a long frame instead of spiralling', () => {
	const loop = new Loop({ stepsPerSecond: 60, maxFrameSeconds: 0.25 });

	// Ten seconds of real time is a paused debugger, not 600 steps of gameplay.
	expect(loop.advance(10)).toBe(15);
});

test('alpha reports progress toward the next step', () => {
	const loop = new Loop({ stepsPerSecond: 60 });

	loop.advance(1 / 120);
	expect(loop.alpha).toBeCloseTo(0.5, 5);
});

test('a node finds the scene it belongs to, however deep', () => {
	class Root extends Node {
		protected override get isSceneRoot(): boolean {
			return true;
		}
	}

	const root = new Root('level');
	const child = root.add(new Node2D('child'));
	const grandchild = child.add(new Node2D('grandchild'));

	expect(grandchild.scene).toBe(root as unknown as typeof grandchild.scene);
});

test('position shorthand and chainable placement', () => {
	const node = new Node2D({ at: [10, 20], rotation: 0.5, zIndex: 3 });

	expect(node.x).toBe(10);
	expect(node.y).toBe(20);
	expect(node.rotation).toBe(0.5);
	expect(node.zIndex).toBe(3);

	node.x = 99;
	expect(node.global.position.x).toBe(99);

	expect(node.at(1, 2)).toBe(node);
	expect(node.y).toBe(2);
});

test('hiding a node hides everything under it', () => {
	const root = new Node2D('root');
	const parent = root.add(new Node2D('parent'));
	parent.add(new Node2D('child'));

	const queue = new RenderQueue();
	queue.collect(root);
	expect(queue.world2d.length).toBe(3);

	parent.visible = false;
	queue.collect(root);

	expect(queue.world2d.map((n) => n.name)).toEqual(['root']);
});
