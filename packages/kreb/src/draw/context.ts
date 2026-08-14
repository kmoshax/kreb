import type { Vector2, Vector3 } from '@kreb/math';
import type { Model, Texture } from '@kreb/raylib-sys';

export type Color = number;

export type TextOptions = {
	size?: number;
	color?: Color;
};

export type SpriteOptions = {
	origin?: Vector2;
	tint?: Color;
};

export type StrokeOptions = {
	thickness?: number;
	color?: Color;
};

export type FillOptions = {
	color?: Color;
};

export type RoundedOptions = FillOptions & {
	/** Corner radius as a fraction of the shorter side, 0 to 1. */
	roundness?: number;
};

export type OutlineOptions = RoundedOptions & {
	thickness?: number;
};

export type GradientOptions = {
	from: Color;
	to: Color;
	/** Horizontal gradients run left to right; vertical run top to bottom. */
	direction?: 'vertical' | 'horizontal';
};

/**
 * Coordinates are local to the node being drawn; the context applies that
 * node's world transform. Contexts are handed in by the render pass and cannot
 * be constructed by user code, which is what makes drawing outside draw(), or
 * into the wrong space, impossible to write.
 */
export interface Draw2D {
	sprite(texture: Texture, at: Vector2, options?: SpriteOptions): void;
	text(value: string, at: Vector2, options?: TextOptions): void;
	line(from: Vector2, to: Vector2, options?: StrokeOptions): void;
	rect(x: number, y: number, width: number, height: number, options?: FillOptions): void;
	roundedRect(x: number, y: number, width: number, height: number, options?: RoundedOptions): void;
	roundedOutline(
		x: number,
		y: number,
		width: number,
		height: number,
		options?: OutlineOptions,
	): void;
	gradient(x: number, y: number, width: number, height: number, options: GradientOptions): void;
	circle(at: Vector2, radius: number, options?: FillOptions): void;
	ring(at: Vector2, inner: number, outer: number, options?: FillOptions): void;
	/** Vertices must be given counter-clockwise or raylib culls the face. */
	triangle(a: Vector2, b: Vector2, c: Vector2, options?: FillOptions): void;
	polygon(
		at: Vector2,
		sides: number,
		radius: number,
		rotation?: number,
		options?: FillOptions,
	): void;
}

export interface Draw3D {
	model(model: Model, options?: SpriteOptions): void;
	/** Camera-facing quad at an offset from the node, for particles and sprites. */
	billboard(texture: Texture, offset: Vector3, size: number, options?: SpriteOptions): void;
	cube(size: Vector3, options?: FillOptions): void;
	sphere(radius: number, options?: FillOptions): void;
	line(from: Vector3, to: Vector3, options?: StrokeOptions): void;
}

export interface DrawUI {
	/** Resolved size of the node being drawn, after any content sizing. */
	readonly width: number;
	readonly height: number;
	text(value: string, x: number, y: number, options?: TextOptions): void;
	/** Width the given text would occupy, for centring and caret placement. */
	measure(value: string, size?: number): number;
	rect(x: number, y: number, width: number, height: number, options?: FillOptions): void;
	roundedRect(x: number, y: number, width: number, height: number, options?: RoundedOptions): void;
	roundedOutline(
		x: number,
		y: number,
		width: number,
		height: number,
		options?: OutlineOptions,
	): void;
	sprite(texture: Texture, x: number, y: number, options?: SpriteOptions): void;
}
