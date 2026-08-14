import { Font, Model, Music, Sound, Texture } from '@kreb/raylib-sys';
import { AssetKind, type AssetRef } from './kinds.ts';

export type Loaded = {
	texture: Texture;
	font: Font;
	sound: Sound;
	music: Music;
	model: Model;
};

export type LoadedAsset = Loaded[AssetKind];

export type AssetLoader = <K extends AssetKind>(ref: AssetRef<K>) => Loaded[K];

export const loadFromDisk: AssetLoader = (ref) => {
	switch (ref.kind) {
		case AssetKind.Texture:
			return Texture.load(ref.path) as never;
		case AssetKind.Font:
			return Font.load(ref.path) as never;
		case AssetKind.Sound:
			return Sound.load(ref.path) as never;
		case AssetKind.Music:
			return Music.load(ref.path) as never;
		case AssetKind.Model:
			return Model.load(ref.path) as never;
		default:
			throw new Error(`Unknown asset kind "${ref.kind}" for ${ref.path}`);
	}
};

type Entry = {
	asset: LoadedAsset;
	refs: number;
};

/**
 * Reference counted so a texture shared by two scenes survives the transition
 * and is disposed exactly once, when the last holder lets go.
 */
export class AssetCache {
	readonly #entries = new Map<string, Entry>();
	readonly #load: AssetLoader;

	constructor(load: AssetLoader = loadFromDisk) {
		this.#load = load;
	}

	get size(): number {
		return this.#entries.size;
	}

	refCount(path: string): number {
		return this.#entries.get(path)?.refs ?? 0;
	}

	acquire<K extends AssetKind>(ref: AssetRef<K>): Loaded[K] {
		const existing = this.#entries.get(ref.path);

		if (existing) {
			existing.refs += 1;
			return existing.asset as Loaded[K];
		}

		const asset = this.#load(ref);
		this.#entries.set(ref.path, { asset, refs: 1 });

		return asset;
	}

	release(path: string): void {
		const entry = this.#entries.get(path);
		if (!entry) return;

		entry.refs -= 1;
		if (entry.refs > 0) return;

		this.#entries.delete(path);
		entry.asset.dispose();
	}

	/** Disposes everything regardless of outstanding references, for shutdown. */
	clear(): void {
		for (const entry of this.#entries.values()) entry.asset.dispose();

		this.#entries.clear();
	}
}
