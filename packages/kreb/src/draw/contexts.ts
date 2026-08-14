import { type Pointer, ptr } from 'bun:ffi';
import type { Vector2, Vector3 } from '@kreb/math';
import type { Model, Texture } from '@kreb/raylib-sys';
import { WHITE } from '@kreb/raylib-sys/colors';
import * as rl from '@kreb/raylib-sys/raylib';
import type { Node2D } from '../core/node-2d.ts';
import type { Rect } from '../core/node-ui.ts';
import type {
	Color,
	Draw2D,
	Draw3D,
	DrawUI,
	FillOptions,
	GradientOptions,
	OutlineOptions,
	RoundedOptions,
	SpriteOptions,
	StrokeOptions,
	TextOptions,
} from './context.ts';

const DEFAULT_TEXT_SIZE = 20;
const DEFAULT_ROUNDNESS = 0.25;

/** Corner smoothness. Enough that a card edge does not look faceted. */
const CORNER_SEGMENTS = 10;

function fill(options?: FillOptions): Color {
	return options?.color ?? WHITE;
}

export class Draw2DContext implements Draw2D {
	#node: Node2D | null = null;

	/** @internal */
	bind(node: Node2D): void {
		this.#node = node;
	}

	sprite(texture: Texture, at: Vector2, options?: SpriteOptions): void {
		const { rotation, scale } = this.#transform();
		const point = this.#toWorld(at);
		const origin = options?.origin ?? { x: 0, y: 0 };

		rl.DrawTexturePro(
			texture.pointer,
			0,
			0,
			texture.width,
			texture.height,
			point.x,
			point.y,
			texture.width * scale.x,
			texture.height * scale.y,
			origin.x * scale.x,
			origin.y * scale.y,
			(rotation * 180) / Math.PI,
			options?.tint ?? WHITE,
		);
	}

	text(value: string, at: Vector2, options?: TextOptions): void {
		const point = this.#toWorld(at);

		rl.DrawText(
			value,
			Math.round(point.x),
			Math.round(point.y),
			options?.size ?? DEFAULT_TEXT_SIZE,
			options?.color ?? WHITE,
		);
	}

	line(from: Vector2, to: Vector2, options?: StrokeOptions): void {
		const a = this.#toWorld(from);
		const b = this.#toWorld(to);

		rl.DrawLineEx(a.x, a.y, b.x, b.y, options?.thickness ?? 1, fill(options));
	}

	rect(x: number, y: number, width: number, height: number, options?: FillOptions): void {
		const point = this.#toWorld({ x, y });
		const { scale } = this.#transform();

		rl.DrawRectangleRec(point.x, point.y, width * scale.x, height * scale.y, fill(options));
	}

	roundedRect(x: number, y: number, width: number, height: number, options?: RoundedOptions): void {
		const point = this.#toWorld({ x, y });
		const { scale } = this.#transform();

		rl.DrawRectangleRounded(
			point.x,
			point.y,
			width * scale.x,
			height * scale.y,
			options?.roundness ?? DEFAULT_ROUNDNESS,
			CORNER_SEGMENTS,
			fill(options),
		);
	}

	roundedOutline(
		x: number,
		y: number,
		width: number,
		height: number,
		options?: OutlineOptions,
	): void {
		const point = this.#toWorld({ x, y });
		const { scale } = this.#transform();

		rl.DrawRectangleRoundedLinesEx(
			point.x,
			point.y,
			width * scale.x,
			height * scale.y,
			options?.roundness ?? DEFAULT_ROUNDNESS,
			CORNER_SEGMENTS,
			options?.thickness ?? 1,
			fill(options),
		);
	}

	gradient(x: number, y: number, width: number, height: number, options: GradientOptions): void {
		const point = this.#toWorld({ x, y });
		const { scale } = this.#transform();
		const w = width * scale.x;
		const h = height * scale.y;

		if (options.direction === 'horizontal') {
			rl.DrawRectangleGradientH(point.x, point.y, w, h, options.from, options.to);
			return;
		}

		rl.DrawRectangleGradientV(point.x, point.y, w, h, options.from, options.to);
	}

	circle(at: Vector2, radius: number, options?: FillOptions): void {
		const point = this.#toWorld(at);
		const { scale } = this.#transform();

		rl.DrawCircleV(point.x, point.y, radius * Math.max(scale.x, scale.y), fill(options));
	}

	ring(at: Vector2, inner: number, outer: number, options?: FillOptions): void {
		const point = this.#toWorld(at);
		const { scale } = this.#transform();
		const factor = Math.max(scale.x, scale.y);

		rl.DrawRing(point.x, point.y, inner * factor, outer * factor, 0, 360, 48, fill(options));
	}

	triangle(a: Vector2, b: Vector2, c: Vector2, options?: FillOptions): void {
		const p1 = this.#toWorld(a);
		const p2 = this.#toWorld(b);
		const p3 = this.#toWorld(c);

		rl.DrawTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, fill(options));
	}

	polygon(at: Vector2, sides: number, radius: number, rotation = 0, options?: FillOptions): void {
		const point = this.#toWorld(at);
		const { scale, rotation: worldRotation } = this.#transform();
		const degrees = rotation + (worldRotation * 180) / Math.PI;

		rl.DrawPoly(
			point.x,
			point.y,
			sides,
			radius * Math.max(scale.x, scale.y),
			degrees,
			fill(options),
		);
	}

	#transform() {
		if (!this.#node) throw new Error('Draw2D used outside of a draw pass');

		return this.#node.global;
	}

	#toWorld(local: Vector2): Vector2 {
		const { position, rotation, scale } = this.#transform();

		const x = local.x * scale.x;
		const y = local.y * scale.y;
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);

		return {
			x: position.x + x * cos - y * sin,
			y: position.y + x * sin + y * cos,
		};
	}
}

export class Draw3DContext implements Draw3D {
	#transform: Float32Array | null = null;
	#position: Vector3 = { x: 0, y: 0, z: 0 };
	#camera: Pointer | null = null;

	/** @internal */
	bind(transform: Float32Array, position: Vector3, camera: Pointer | null): void {
		this.#transform = transform;
		this.#position = position;
		this.#camera = camera;
	}

	billboard(texture: Texture, offset: Vector3, size: number, options?: SpriteOptions): void {
		if (this.#camera === null) {
			throw new Error('Draw3D.billboard needs an active Camera3D on the scene');
		}

		const p = this.#position;

		rl.DrawBillboard(
			this.#camera,
			texture.pointer,
			p.x + offset.x,
			p.y + offset.y,
			p.z + offset.z,
			size,
			options?.tint ?? WHITE,
		);
	}

	model(model: Model, options?: SpriteOptions): void {
		if (!this.#transform) throw new Error('Draw3D used outside of a draw pass');

		// The node's composed matrix goes straight into the model, which is the
		// only route that survives arbitrary nesting.
		rl.symbols().kreb_set_Model_transform(model.pointer, ptr(this.#transform));
		rl.DrawModel(model.pointer, 0, 0, 0, 1, options?.tint ?? WHITE);
	}

	cube(size: Vector3, options?: FillOptions): void {
		const p = this.#position;

		rl.DrawCubeV(p.x, p.y, p.z, size.x, size.y, size.z, fill(options));
	}

	sphere(radius: number, options?: FillOptions): void {
		const p = this.#position;

		rl.DrawSphere(p.x, p.y, p.z, radius, fill(options));
	}

	line(from: Vector3, to: Vector3, options?: StrokeOptions): void {
		const p = this.#position;

		rl.DrawLine3D(
			p.x + from.x,
			p.y + from.y,
			p.z + from.z,
			p.x + to.x,
			p.y + to.y,
			p.z + to.z,
			fill(options),
		);
	}
}

export class DrawUIContext implements DrawUI {
	#rect: Rect = { x: 0, y: 0, width: 0, height: 0 };

	/** @internal */
	bind(rect: Rect): void {
		this.#rect = rect;
	}

	get width(): number {
		return this.#rect.width;
	}

	get height(): number {
		return this.#rect.height;
	}

	text(value: string, x: number, y: number, options?: TextOptions): void {
		rl.DrawText(
			value,
			Math.round(this.#rect.x + x),
			Math.round(this.#rect.y + y),
			options?.size ?? DEFAULT_TEXT_SIZE,
			options?.color ?? WHITE,
		);
	}

	measure(value: string, size = DEFAULT_TEXT_SIZE): number {
		return rl.MeasureText(value, size);
	}

	rect(x: number, y: number, width: number, height: number, options?: FillOptions): void {
		rl.DrawRectangleRec(this.#rect.x + x, this.#rect.y + y, width, height, fill(options));
	}

	roundedRect(x: number, y: number, width: number, height: number, options?: RoundedOptions): void {
		rl.DrawRectangleRounded(
			this.#rect.x + x,
			this.#rect.y + y,
			width,
			height,
			options?.roundness ?? DEFAULT_ROUNDNESS,
			CORNER_SEGMENTS,
			fill(options),
		);
	}

	roundedOutline(
		x: number,
		y: number,
		width: number,
		height: number,
		options?: OutlineOptions,
	): void {
		rl.DrawRectangleRoundedLinesEx(
			this.#rect.x + x,
			this.#rect.y + y,
			width,
			height,
			options?.roundness ?? DEFAULT_ROUNDNESS,
			CORNER_SEGMENTS,
			options?.thickness ?? 1,
			fill(options),
		);
	}

	sprite(texture: Texture, x: number, y: number, options?: SpriteOptions): void {
		rl.DrawTexture(
			texture.pointer,
			Math.round(this.#rect.x + x),
			Math.round(this.#rect.y + y),
			options?.tint ?? WHITE,
		);
	}
}
