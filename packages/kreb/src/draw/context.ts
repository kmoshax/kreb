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
	circle(at: Vector2, radius: number, options?: FillOptions): void;
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
	text(value: string, x: number, y: number, options?: TextOptions): void;
	/** Width the given text would occupy, for centring and caret placement. */
	measure(value: string, size?: number): number;
	rect(x: number, y: number, width: number, height: number, options?: FillOptions): void;
	sprite(texture: Texture, x: number, y: number, options?: SpriteOptions): void;
}
