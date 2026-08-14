import type { Quaternion, Vector2, Vector3 } from '@kreb/math';

// Plain objects would let `node.position.x += 1` change the transform without
// the node ever hearing about it, which silently defeats the dirty-flag cache.
// These carry the same shape but report every write.

export class TrackedVector2 implements Vector2 {
	#x: number;
	#y: number;
	readonly #onChange: () => void;

	constructor(x: number, y: number, onChange: () => void) {
		this.#x = x;
		this.#y = y;
		this.#onChange = onChange;
	}

	get x(): number {
		return this.#x;
	}

	set x(value: number) {
		if (value === this.#x) return;
		this.#x = value;
		this.#onChange();
	}

	get y(): number {
		return this.#y;
	}

	set y(value: number) {
		if (value === this.#y) return;
		this.#y = value;
		this.#onChange();
	}

	set(source: Vector2): void {
		if (source.x === this.#x && source.y === this.#y) return;
		this.#x = source.x;
		this.#y = source.y;
		this.#onChange();
	}
}

export class TrackedVector3 implements Vector3 {
	#x: number;
	#y: number;
	#z: number;
	readonly #onChange: () => void;

	constructor(x: number, y: number, z: number, onChange: () => void) {
		this.#x = x;
		this.#y = y;
		this.#z = z;
		this.#onChange = onChange;
	}

	get x(): number {
		return this.#x;
	}

	set x(value: number) {
		if (value === this.#x) return;
		this.#x = value;
		this.#onChange();
	}

	get y(): number {
		return this.#y;
	}

	set y(value: number) {
		if (value === this.#y) return;
		this.#y = value;
		this.#onChange();
	}

	get z(): number {
		return this.#z;
	}

	set z(value: number) {
		if (value === this.#z) return;
		this.#z = value;
		this.#onChange();
	}

	set(source: Vector3): void {
		if (source.x === this.#x && source.y === this.#y && source.z === this.#z) return;
		this.#x = source.x;
		this.#y = source.y;
		this.#z = source.z;
		this.#onChange();
	}
}

export class TrackedQuaternion implements Quaternion {
	#x: number;
	#y: number;
	#z: number;
	#w: number;
	readonly #onChange: () => void;

	constructor(x: number, y: number, z: number, w: number, onChange: () => void) {
		this.#x = x;
		this.#y = y;
		this.#z = z;
		this.#w = w;
		this.#onChange = onChange;
	}

	get x(): number {
		return this.#x;
	}

	set x(value: number) {
		if (value === this.#x) return;
		this.#x = value;
		this.#onChange();
	}

	get y(): number {
		return this.#y;
	}

	set y(value: number) {
		if (value === this.#y) return;
		this.#y = value;
		this.#onChange();
	}

	get z(): number {
		return this.#z;
	}

	set z(value: number) {
		if (value === this.#z) return;
		this.#z = value;
		this.#onChange();
	}

	get w(): number {
		return this.#w;
	}

	set w(value: number) {
		if (value === this.#w) return;
		this.#w = value;
		this.#onChange();
	}

	set(source: Quaternion): void {
		if (
			source.x === this.#x &&
			source.y === this.#y &&
			source.z === this.#z &&
			source.w === this.#w
		) {
			return;
		}

		this.#x = source.x;
		this.#y = source.y;
		this.#z = source.z;
		this.#w = source.w;
		this.#onChange();
	}
}
