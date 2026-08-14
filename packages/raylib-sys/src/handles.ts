import type { Pointer } from 'bun:ffi';
import * as rl from '@kreb/raylib-sys/raylib';

const DEV = process.env.NODE_ENV !== 'production';

// Warns only. Unloading here would issue GL calls at an arbitrary point in the
// collector's schedule, possibly after CloseWindow, which is a hard crash.
const leaks = new FinalizationRegistry<string>((label) => {
	console.warn(`kreb: ${label} was garbage collected while still loaded. Call dispose().`);
});

export abstract class Resource {
	#pointer: Pointer | null;
	readonly #label: string;

	protected constructor(pointer: Pointer | null, label: string) {
		if (pointer === null) {
			throw new Error(`Failed to load ${label}: raylib returned no data`);
		}

		this.#pointer = pointer;
		this.#label = label;

		if (!this.isValid(pointer)) {
			rl.free(pointer);
			this.#pointer = null;
			throw new Error(`Failed to load ${label}`);
		}

		if (DEV) leaks.register(this, label, this);
	}

	get pointer(): Pointer {
		if (this.#pointer === null) {
			throw new Error(`${this.#label} was used after dispose()`);
		}

		return this.#pointer;
	}

	get label(): string {
		return this.#label;
	}

	get disposed(): boolean {
		return this.#pointer === null;
	}

	protected abstract unload(pointer: Pointer): void;

	protected isValid(_pointer: Pointer): boolean {
		return true;
	}

	dispose(): void {
		const pointer = this.#pointer;
		if (pointer === null) return;

		this.#pointer = null;
		if (DEV) leaks.unregister(this);

		this.unload(pointer);
		rl.free(pointer);
	}

	// For when raylib has handed the resource to another owner: frees this
	// wrapper's heap copy but leaves the resource itself alone.
	disown(): void {
		const pointer = this.#pointer;
		if (pointer === null) return;

		this.#pointer = null;
		if (DEV) leaks.unregister(this);

		rl.free(pointer);
	}

	[Symbol.dispose](): void {
		this.dispose();
	}
}

export class Image extends Resource {
	static load(fileName: string): Image {
		return new Image(rl.LoadImage(fileName), `Image("${fileName}")`);
	}

	static color(width: number, height: number, color: number): Image {
		return new Image(rl.GenImageColor(width, height, color), `Image(${width}x${height})`);
	}

	get width(): number {
		return rl.symbols.kreb_get_Image_width(this.pointer);
	}

	get height(): number {
		return rl.symbols.kreb_get_Image_height(this.pointer);
	}

	get format(): number {
		return rl.symbols.kreb_get_Image_format(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Image_width(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadImage(pointer);
	}
}

export class Texture extends Resource {
	static load(fileName: string): Texture {
		return new Texture(rl.LoadTexture(fileName), `Texture("${fileName}")`);
	}

	static fromImage(image: Image): Texture {
		return new Texture(rl.LoadTextureFromImage(image.pointer), `Texture(${image.label})`);
	}

	get id(): number {
		return rl.symbols.kreb_get_Texture_id(this.pointer);
	}

	get width(): number {
		return rl.symbols.kreb_get_Texture_width(this.pointer);
	}

	get height(): number {
		return rl.symbols.kreb_get_Texture_height(this.pointer);
	}

	// raylib signals a failed GPU upload with id 0 rather than an error, and a
	// zero-id texture silently draws nothing.
	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Texture_id(pointer) !== 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadTexture(pointer);
	}
}

export class RenderTexture extends Resource {
	static create(width: number, height: number): RenderTexture {
		return new RenderTexture(
			rl.LoadRenderTexture(width, height),
			`RenderTexture(${width}x${height})`,
		);
	}

	get id(): number {
		return rl.symbols.kreb_get_RenderTexture_id(this.pointer);
	}

	get texture(): Pointer {
		const texture = rl.symbols.kreb_ref_RenderTexture_texture(this.pointer);
		if (texture === null) throw new Error(`${this.label} has no texture`);

		return texture;
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_RenderTexture_id(pointer) !== 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadRenderTexture(pointer);
	}
}

export class Font extends Resource {
	static load(fileName: string): Font {
		return new Font(rl.LoadFont(fileName), `Font("${fileName}")`);
	}

	get baseSize(): number {
		return rl.symbols.kreb_get_Font_baseSize(this.pointer);
	}

	get glyphCount(): number {
		return rl.symbols.kreb_get_Font_glyphCount(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Font_glyphCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadFont(pointer);
	}
}

export class Shader extends Resource {
	static fromMemory(vertex: string, fragment: string): Shader {
		return new Shader(rl.LoadShaderFromMemory(vertex, fragment), 'Shader(memory)');
	}

	get id(): number {
		return rl.symbols.kreb_get_Shader_id(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Shader_id(pointer) !== 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadShader(pointer);
	}
}

export class Wave extends Resource {
	static load(fileName: string): Wave {
		return new Wave(rl.LoadWave(fileName), `Wave("${fileName}")`);
	}

	get frameCount(): number {
		return rl.symbols.kreb_get_Wave_frameCount(this.pointer);
	}

	get sampleRate(): number {
		return rl.symbols.kreb_get_Wave_sampleRate(this.pointer);
	}

	get channels(): number {
		return rl.symbols.kreb_get_Wave_channels(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Wave_frameCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadWave(pointer);
	}
}

export class Sound extends Resource {
	static load(fileName: string): Sound {
		return new Sound(rl.LoadSound(fileName), `Sound("${fileName}")`);
	}

	static fromWave(wave: Wave): Sound {
		return new Sound(rl.LoadSoundFromWave(wave.pointer), `Sound(${wave.label})`);
	}

	get frameCount(): number {
		return rl.symbols.kreb_get_Sound_frameCount(this.pointer);
	}

	play(): void {
		rl.PlaySound(this.pointer);
	}

	stop(): void {
		rl.StopSound(this.pointer);
	}

	get playing(): boolean {
		return rl.IsSoundPlaying(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Sound_frameCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadSound(pointer);
	}
}

export class Music extends Resource {
	static load(fileName: string): Music {
		return new Music(rl.LoadMusicStream(fileName), `Music("${fileName}")`);
	}

	get frameCount(): number {
		return rl.symbols.kreb_get_Music_frameCount(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Music_frameCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadMusicStream(pointer);
	}
}

export class Mesh extends Resource {
	static cube(width: number, height: number, length: number): Mesh {
		return new Mesh(rl.GenMeshCube(width, height, length), 'Mesh(cube)');
	}

	static sphere(radius: number, rings: number, slices: number): Mesh {
		return new Mesh(rl.GenMeshSphere(radius, rings, slices), 'Mesh(sphere)');
	}

	get vertexCount(): number {
		return rl.symbols.kreb_get_Mesh_vertexCount(this.pointer);
	}

	get triangleCount(): number {
		return rl.symbols.kreb_get_Mesh_triangleCount(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Mesh_vertexCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadMesh(pointer);
	}
}

export class Model extends Resource {
	static load(fileName: string): Model {
		return new Model(rl.LoadModel(fileName), `Model("${fileName}")`);
	}

	// UnloadModel frees the mesh it was built from, so the Mesh wrapper gives up
	// ownership here; disposing it separately would double free.
	static fromMesh(mesh: Mesh): Model {
		const model = new Model(rl.LoadModelFromMesh(mesh.pointer), `Model(${mesh.label})`);
		mesh.disown();

		return model;
	}

	get meshCount(): number {
		return rl.symbols.kreb_get_Model_meshCount(this.pointer);
	}

	get materialCount(): number {
		return rl.symbols.kreb_get_Model_materialCount(this.pointer);
	}

	protected override isValid(pointer: Pointer): boolean {
		return rl.symbols.kreb_get_Model_meshCount(pointer) > 0;
	}

	protected unload(pointer: Pointer): void {
		rl.UnloadModel(pointer);
	}
}
