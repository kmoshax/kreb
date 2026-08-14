export const AssetKind = {
	Texture: 'texture',
	Font: 'font',
	Sound: 'sound',
	Music: 'music',
	Model: 'model',
} as const;

export type AssetKind = (typeof AssetKind)[keyof typeof AssetKind];

/**
 * The generated manifest hands these out instead of raw paths, so a renamed
 * file is a compile error rather than a runtime crash.
 */
export type AssetRef<K extends AssetKind = AssetKind> = {
	readonly kind: K;
	readonly path: string;
};

const BY_EXTENSION: Record<string, AssetKind> = {
	png: AssetKind.Texture,
	jpg: AssetKind.Texture,
	jpeg: AssetKind.Texture,
	bmp: AssetKind.Texture,
	tga: AssetKind.Texture,
	gif: AssetKind.Texture,
	qoi: AssetKind.Texture,
	ttf: AssetKind.Font,
	otf: AssetKind.Font,
	fnt: AssetKind.Font,
	wav: AssetKind.Sound,
	ogg: AssetKind.Sound,
	mp3: AssetKind.Sound,
	flac: AssetKind.Sound,
	qoa: AssetKind.Sound,
	glb: AssetKind.Model,
	gltf: AssetKind.Model,
	obj: AssetKind.Model,
	iqm: AssetKind.Model,
	vox: AssetKind.Model,
	m3d: AssetKind.Model,
};

/** Files under assets/music stream instead of loading whole into memory. */
const MUSIC_DIRECTORY = 'music';

export function kindFor(relativePath: string): AssetKind | null {
	const extension = relativePath.split('.').pop()?.toLowerCase();
	if (!extension) return null;

	const kind = BY_EXTENSION[extension];
	if (!kind) return null;

	if (kind === AssetKind.Sound && relativePath.split('/')[0] === MUSIC_DIRECTORY) {
		return AssetKind.Music;
	}

	return kind;
}

export const GROUP_FOR_KIND: Record<AssetKind, string> = {
	[AssetKind.Texture]: 'textures',
	[AssetKind.Font]: 'fonts',
	[AssetKind.Sound]: 'sounds',
	[AssetKind.Music]: 'music',
	[AssetKind.Model]: 'models',
};
