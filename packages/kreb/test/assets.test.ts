import { expect, test } from 'bun:test';
import { AssetCache, type AssetLoader } from 'kreb/assets/cache';
import { AssetKind, type AssetRef, kindFor } from 'kreb/assets/kinds';
import { keyFor, planManifest, renderManifest } from 'kreb/assets/manifest';
import { AssetQueue } from 'kreb/assets/queue';
import { AssetScope } from 'kreb/assets/scope';

type Fake = { path: string; disposed: boolean; dispose(): void };

function fakeCache() {
	const created: Fake[] = [];

	const load = ((ref: AssetRef) => {
		const asset: Fake = {
			path: ref.path,
			disposed: false,
			dispose() {
				this.disposed = true;
			},
		};

		created.push(asset);
		return asset;
	}) as unknown as AssetLoader;

	return { cache: new AssetCache(load), created };
}

const texture = (path: string): AssetRef<'texture'> => ({ kind: AssetKind.Texture, path });

test('a repeated acquire reuses the loaded asset', () => {
	const { cache, created } = fakeCache();

	const first = cache.acquire(texture('a.png'));
	const second = cache.acquire(texture('a.png'));

	expect(first).toBe(second);
	expect(created.length).toBe(1);
	expect(cache.refCount('a.png')).toBe(2);
});

test('an asset survives until the last reference is released', () => {
	const { cache, created } = fakeCache();

	cache.acquire(texture('a.png'));
	cache.acquire(texture('a.png'));

	cache.release('a.png');
	expect(created[0]?.disposed).toBe(false);
	expect(cache.size).toBe(1);

	cache.release('a.png');
	expect(created[0]?.disposed).toBe(true);
	expect(cache.size).toBe(0);
});

test('releasing an unknown path is a no-op', () => {
	const { cache } = fakeCache();

	expect(() => cache.release('never-loaded.png')).not.toThrow();
});

test('a scope releases everything it took', () => {
	const { cache, created } = fakeCache();
	const scope = new AssetScope(cache);

	scope.load(texture('a.png'));
	scope.load(texture('b.png'));
	expect(scope.size).toBe(2);

	scope.releaseAll();
	expect(created.every((asset) => asset.disposed)).toBe(true);
	expect(cache.size).toBe(0);
});

test('two scopes sharing an asset keep it alive until both exit', () => {
	const { cache, created } = fakeCache();
	const level = new AssetScope(cache);
	const overlay = new AssetScope(cache);

	level.load(texture('shared.png'));
	overlay.load(texture('shared.png'));

	level.releaseAll();
	expect(created[0]?.disposed).toBe(false);

	overlay.releaseAll();
	expect(created[0]?.disposed).toBe(true);
});

test('releaseAll is idempotent and loading after it throws', () => {
	const { cache } = fakeCache();
	const scope = new AssetScope(cache);

	scope.load(texture('a.png'));
	scope.releaseAll();

	expect(() => scope.releaseAll()).not.toThrow();
	expect(() => scope.load(texture('b.png'))).toThrow('was released');
});

test('the queue spends a budget and resumes where it stopped', () => {
	const { cache } = fakeCache();
	const scope = new AssetScope(cache);

	let clock = 0;
	const queue = new AssetQueue(scope, () => {
		clock += 1;
		return clock;
	});

	queue.enqueue(texture('a.png'), texture('b.png'), texture('c.png'));

	// The clock advances one unit per read, so a budget of 1 admits one asset.
	const first = queue.pump(1);
	expect(first.loaded).toBe(1);
	expect(first.done).toBe(false);

	const rest = queue.pumpAll();
	expect(rest.loaded).toBe(3);
	expect(rest.done).toBe(true);
});

test('the queue always loads at least one asset per pump', () => {
	const { cache } = fakeCache();
	const scope = new AssetScope(cache);
	const queue = new AssetQueue(scope, () => 1000);

	queue.enqueue(texture('a.png'));

	// Budget already exhausted before the first read; a naive loop would stall.
	expect(queue.pump(0).loaded).toBe(1);
});

test('extensions map to kinds, and music streams by directory', () => {
	expect(kindFor('player.png')).toBe(AssetKind.Texture);
	expect(kindFor('ui/font.ttf')).toBe(AssetKind.Font);
	expect(kindFor('sfx/jump.wav')).toBe(AssetKind.Sound);
	expect(kindFor('music/theme.ogg')).toBe(AssetKind.Music);
	expect(kindFor('ship.glb')).toBe(AssetKind.Model);
	expect(kindFor('notes.txt')).toBeNull();
});

test('keys are derived from the path, not just the file name', () => {
	expect(keyFor('ui/buttons/play.png')).toBe('ui_buttons_play');
	expect(keyFor('01-intro.ogg')).toBe('_01_intro');
});

test('the manifest groups by kind and reports ignored files', () => {
	const plan = planManifest(['player.png', 'music/theme.ogg', 'sfx/jump.wav', 'notes.txt']);

	expect(plan.entries.map((e) => `${e.group}.${e.key}`).sort()).toEqual([
		'music.music_theme',
		'sounds.sfx_jump',
		'textures.player',
	]);
	expect(plan.ignored).toEqual(['notes.txt']);
});

test('two assets colliding on one key name both files', () => {
	expect(() => planManifest(['ui/play.png', 'ui-play.png'])).toThrow('both map to');
});

test('the rendered manifest is valid typed source', () => {
	const source = renderManifest(planManifest(['player.png']));

	expect(source).toContain("import type { AssetRef } from 'kreb';");
	expect(source).toContain("player: { kind: 'texture', path: 'assets/player.png' },");
	expect(source).toContain('as const satisfies Record<string, Record<string, AssetRef>>');
});
