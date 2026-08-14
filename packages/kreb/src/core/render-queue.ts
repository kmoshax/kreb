import { type Node, RenderSpace } from './node.ts';
import type { Node2D } from './node-2d.ts';
import type { Node3D } from './node-3d.ts';
import type { NodeUI } from './node-ui.ts';

/**
 * raylib requires 3D draws inside BeginMode3D, 2D world draws inside
 * BeginMode2D, and UI outside both. A traversal that drew as it walked could
 * not produce that ordering: a UI node parented under a Node3D would emit its
 * call mid-3D-pass. So the walk collects into buckets and the buckets execute.
 */
export class RenderQueue {
	readonly world3d: Node3D[] = [];
	readonly world2d: Node2D[] = [];
	readonly ui: NodeUI[] = [];

	clear(): void {
		this.world3d.length = 0;
		this.world2d.length = 0;
		this.ui.length = 0;
	}

	collect(root: Node): void {
		this.clear();
		this.#walk(root);
	}

	/** Front-to-back for 3D, painter order for the flat spaces. */
	sort(eye: { x: number; y: number; z: number } | null): void {
		this.world2d.sort((a, b) => a.zIndex - b.zIndex);
		this.ui.sort((a, b) => a.zIndex - b.zIndex);

		if (!eye || this.world3d.length < 2) return;
		const depth = new Map<Node3D, number>();

		for (const node of this.world3d) {
			const p = node.globalPosition;
			const dx = p.x - eye.x;
			const dy = p.y - eye.y;
			const dz = p.z - eye.z;
			depth.set(node, dx * dx + dy * dy + dz * dz);
		}

		this.world3d.sort((a, b) => (depth.get(a) as number) - (depth.get(b) as number));
	}

	#walk(node: Node): void {
		if (node.destroyed) return;

		switch (node.space) {
			case RenderSpace.World3D:
				this.world3d.push(node as Node3D);
				break;
			case RenderSpace.World2D:
				this.world2d.push(node as Node2D);
				break;
			case RenderSpace.Ui:
				this.ui.push(node as NodeUI);
				break;
		}

		for (const child of node.children) this.#walk(child);
	}
}
