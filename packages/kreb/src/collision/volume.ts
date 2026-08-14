/**
 * Collision math is written over coordinate arrays rather than Vector2/Vector3
 * so 2D and 3D share one implementation. Every function requires both operands
 * to have the same length; mixing dimensions is a caller error.
 */

export type Box = { kind: 'box'; center: readonly number[]; half: readonly number[] };
export type Sphere = { kind: 'sphere'; center: readonly number[]; radius: number };
export type Volume = Box | Sphere;

export type Bounds = { min: readonly number[]; max: readonly number[] };

export function boundsOf(volume: Volume): Bounds {
	const min: number[] = [];
	const max: number[] = [];

	for (let i = 0; i < volume.center.length; i += 1) {
		const extent = volume.kind === 'box' ? (volume.half[i] as number) : volume.radius;
		const centre = volume.center[i] as number;

		min.push(centre - extent);
		max.push(centre + extent);
	}

	return { min, max };
}

export function boundsOverlap(a: Bounds, b: Bounds): boolean {
	for (let i = 0; i < a.min.length; i += 1) {
		if ((a.max[i] as number) < (b.min[i] as number)) return false;
		if ((a.min[i] as number) > (b.max[i] as number)) return false;
	}

	return true;
}

function clampToBox(point: readonly number[], box: Box): number[] {
	return point.map((value, i) => {
		const centre = box.center[i] as number;
		const half = box.half[i] as number;

		return Math.min(Math.max(value, centre - half), centre + half);
	});
}

function distanceSquared(a: readonly number[], b: readonly number[]): number {
	let total = 0;

	for (let i = 0; i < a.length; i += 1) {
		const delta = (a[i] as number) - (b[i] as number);
		total += delta * delta;
	}

	return total;
}

export function overlaps(a: Volume, b: Volume): boolean {
	if (a.kind === 'box' && b.kind === 'box') {
		return boundsOverlap(boundsOf(a), boundsOf(b));
	}

	if (a.kind === 'sphere' && b.kind === 'sphere') {
		const reach = a.radius + b.radius;
		return distanceSquared(a.center, b.center) <= reach * reach;
	}

	const box = (a.kind === 'box' ? a : b) as Box;
	const sphere = (a.kind === 'sphere' ? a : b) as Sphere;

	const closest = clampToBox(sphere.center, box);
	return distanceSquared(closest, sphere.center) <= sphere.radius * sphere.radius;
}

export type RayResult =
	| { hit: true; distance: number; point: readonly number[]; normal: readonly number[] }
	| { hit: false };

export const MISS: RayResult = { hit: false };

function pointAt(
	origin: readonly number[],
	direction: readonly number[],
	distance: number,
): number[] {
	return origin.map((value, i) => value + (direction[i] as number) * distance);
}

/** Slab method, dimension agnostic. `direction` is expected to be normalized. */
export function rayBox(
	origin: readonly number[],
	direction: readonly number[],
	box: Box,
	maxDistance: number,
): RayResult {
	const { min, max } = boundsOf(box);

	let near = 0;
	let far = maxDistance;
	let axis = -1;
	let sign = 1;

	for (let i = 0; i < origin.length; i += 1) {
		const d = direction[i] as number;
		const o = origin[i] as number;

		if (Math.abs(d) < 1e-8) {
			if (o < (min[i] as number) || o > (max[i] as number)) return MISS;
			continue;
		}

		const inverse = 1 / d;
		let t1 = ((min[i] as number) - o) * inverse;
		let t2 = ((max[i] as number) - o) * inverse;
		let entrySign = -1;

		if (t1 > t2) {
			[t1, t2] = [t2, t1];
			entrySign = 1;
		}

		if (t1 > near) {
			near = t1;
			axis = i;
			sign = entrySign;
		}

		if (t2 < far) far = t2;
		if (near > far) return MISS;
	}

	const normal = origin.map(() => 0);
	if (axis >= 0) normal[axis] = sign;

	return { hit: true, distance: near, point: pointAt(origin, direction, near), normal };
}

export function raySphere(
	origin: readonly number[],
	direction: readonly number[],
	sphere: Sphere,
	maxDistance: number,
): RayResult {
	const toCentre = sphere.center.map((value, i) => value - (origin[i] as number));

	let projection = 0;
	for (let i = 0; i < direction.length; i += 1) {
		projection += (toCentre[i] as number) * (direction[i] as number);
	}

	const centreDistanceSquared = toCentre.reduce((total, value) => total + value * value, 0);
	const gap = centreDistanceSquared - projection * projection;
	const radiusSquared = sphere.radius * sphere.radius;

	if (gap > radiusSquared) return MISS;

	const halfChord = Math.sqrt(radiusSquared - gap);
	const entry = projection - halfChord;
	const exit = projection + halfChord;

	// An origin inside the sphere reports a zero-distance hit rather than a miss.
	const distance = entry >= 0 ? entry : exit;
	if (distance < 0 || distance > maxDistance) return MISS;

	const point = pointAt(origin, direction, distance);
	const normal = point.map((value, i) => (value - (sphere.center[i] as number)) / sphere.radius);

	return { hit: true, distance, point, normal };
}

export function rayVolume(
	origin: readonly number[],
	direction: readonly number[],
	volume: Volume,
	maxDistance: number,
): RayResult {
	return volume.kind === 'box'
		? rayBox(origin, direction, volume, maxDistance)
		: raySphere(origin, direction, volume, maxDistance);
}
