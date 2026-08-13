import { mkdir, rename, rm } from 'node:fs/promises';
import { $ } from 'bun';
import { RAYLIB_VERSION, raylibPaths } from '../src/raylib-path.ts';
import { currentTarget, currentTargetKey } from '../src/targets.ts';

const RELEASE_BASE = 'https://github.com/raysan5/raylib/releases/download';

export async function ensureRaylib({ force = false } = {}): Promise<string> {
	const paths = raylibPaths();

	if (!force && (await isInstalled())) {
		return paths.root;
	}

	const target = currentTarget();
	const url = `${RELEASE_BASE}/${RAYLIB_VERSION}/${target.asset}`;

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}

	const archive = new Uint8Array(await response.arrayBuffer());
	verifyDigest(archive, target.sha256, target.asset);

	// Extract into a staging directory and rename into place, so an interrupted
	// install can never leave a half-unpacked tree that looks complete.
	const staging = `${paths.root}.staging`;
	await rm(staging, { recursive: true, force: true });
	await mkdir(staging, { recursive: true });

	const archivePath = `${staging}/${target.asset}`;
	await Bun.write(archivePath, archive);

	// bsdtar on Windows reads zip; GNU tar on Linux only sees the tar.gz targets.
	await $`tar xf ${archivePath} --strip-components=1 -C ${staging}`.quiet();
	await rm(archivePath);

	await rm(paths.root, { recursive: true, force: true });
	await mkdir(paths.root.split('/').slice(0, -1).join('/'), { recursive: true });
	await rename(staging, paths.root);

	await assertVersionMatches();
	return paths.root;
}

async function isInstalled(): Promise<boolean> {
	const paths = raylibPaths();
	if (!(await Bun.file(`${paths.include}/raylib.h`).exists())) return false;

	return (await readHeaderVersion()) === RAYLIB_VERSION;
}

async function readHeaderVersion(): Promise<string | null> {
	const header = await Bun.file(`${raylibPaths().include}/raylib.h`).text();
	return /#define\s+RAYLIB_VERSION\s+"([^"]+)"/.exec(header)?.[1] ?? null;
}

async function assertVersionMatches(): Promise<void> {
	const found = await readHeaderVersion();

	if (found !== RAYLIB_VERSION) {
		throw new Error(
			`Downloaded raylib reports version ${found}, expected ${RAYLIB_VERSION}. ` +
				`The pinned digest and version in src/targets.ts disagree with the release.`,
		);
	}
}

function verifyDigest(bytes: Uint8Array, expected: string, assetName: string): void {
	const actual = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

	if (actual !== expected) {
		throw new Error(
			`Checksum mismatch for ${assetName}.\n  expected ${expected}\n  actual   ${actual}`,
		);
	}
}

if (import.meta.main) {
	const root = await ensureRaylib();
	console.log(`raylib ${RAYLIB_VERSION} ready for ${currentTargetKey()} at ${root}`);
}
