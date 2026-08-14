export const RenderSpace = {
	World3D: 'world3d',
	World2D: 'world2d',
	Ui: 'ui',
} as const;

export type RenderSpace = (typeof RenderSpace)[keyof typeof RenderSpace];

import type { Scene } from '../scene/scene.ts';

export abstract class Node {
	name: string;

	#parent: Node | null = null;
	readonly #children: Node[] = [];
	#inTree = false;
	#destroyed = false;

	constructor(name?: string) {
		this.name = name ?? new.target.name;
	}

	/** Null for nodes that organise the tree without drawing, such as Scene. */
	get space(): RenderSpace | null {
		return null;
	}

	get parent(): Node | null {
		return this.#parent;
	}

	/** Overridden by Scene; lets a node find its root without importing Scene. */
	protected get isSceneRoot(): boolean {
		return false;
	}

	/**
	 * The Scene this node belongs to. Throws rather than returning null: a node
	 * outside a scene has no assets, tweens or collision world to reach for, and
	 * silently doing nothing is worse than saying so.
	 */
	get scene(): Scene {
		for (let node: Node | null = this; node; node = node.#parent) {
			// The flag is the discriminator; Node cannot name Scene at runtime.
			if (node.isSceneRoot) return node as unknown as Scene;
		}

		throw new Error(`Node "${this.name}" is not inside a Scene`);
	}

	get children(): readonly Node[] {
		return this.#children;
	}

	get inTree(): boolean {
		return this.#inTree;
	}

	get destroyed(): boolean {
		return this.#destroyed;
	}

	add<T extends Node>(child: T): T {
		if (child === (this as Node)) {
			throw new Error(`Cannot add node "${this.name}" to itself`);
		}

		if (child.#destroyed) {
			throw new Error(`Cannot add destroyed node "${child.name}" to "${this.name}"`);
		}

		for (let ancestor: Node | null = this; ancestor; ancestor = ancestor.#parent) {
			if (ancestor === (child as Node)) {
				throw new Error(`Cannot add "${child.name}" to its own descendant "${this.name}"`);
			}
		}

		child.#parent?.remove(child);
		child.#parent = this;
		this.#children.push(child);
		child.onTransformChanged();

		if (this.#inTree) child.enterTree();

		return child;
	}

	remove(child: Node): void {
		const index = this.#children.indexOf(child);
		if (index === -1) {
			throw new Error(`Node "${child.name}" is not a child of "${this.name}"`);
		}

		this.#children.splice(index, 1);
		child.#parent = null;
		child.onTransformChanged();

		if (child.#inTree) child.leaveTree();
	}

	ready(): void {}

	update(_dt: number): void {}

	exitTree(): void {}

	destroy(): void {
		if (this.#destroyed) return;

		for (const child of [...this.#children]) child.destroy();

		this.#parent?.remove(this);
		this.#destroyed = true;
	}

	/** @internal */
	enterTree(): void {
		if (this.#inTree) return;

		this.#inTree = true;
		this.ready();

		for (const child of this.#children) child.enterTree();
	}

	/** @internal */
	leaveTree(): void {
		if (!this.#inTree) return;

		for (const child of this.#children) child.leaveTree();

		this.#inTree = false;
		this.exitTree();
	}

	/** @internal */
	updateTree(dt: number): void {
		if (this.#destroyed) return;

		this.update(dt);
		for (const child of [...this.#children]) child.updateTree(dt);
	}

	/**
	 * Invalidates this node's cached world transform and every descendant's,
	 * because a descendant's world transform is derived from this one.
	 */
	protected onTransformChanged(): void {
		for (const child of this.#children) child.onTransformChanged();
	}
}
