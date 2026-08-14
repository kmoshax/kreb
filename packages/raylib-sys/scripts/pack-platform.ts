import { mkdir, rm } from 'node:fs/promises';
import { SHIM_SOURCE, shimPath } from '../src/shim-path.ts';
import { currentTargetKey } from '../src/targets.ts';
import { buildShim } from './build-shim.ts';

const SHIM_NAME = 'kreb_raylib';

export function platformPackageName(target = currentTargetKey()): string {
	return `kreb-${target}`;
}

/**
 * One tiny package per platform, selected by npm through `os` and `cpu`, so a
 * user downloads only the binary they can actually run.
 */
export async function packPlatform(version: string, outDir = 'dist-platform'): Promise<string> {
	const target = currentTargetKey();
	const [os, cpu] = target.split('-');

	if (!os || !cpu) throw new Error(`Cannot split target "${target}" into os and cpu`);

	await buildShim([SHIM_SOURCE], SHIM_NAME, { force: true });

	const libPath = shimPath(SHIM_NAME);
	const libName = libPath.split('/').pop();
	if (!libName) throw new Error(`Cannot read a file name from ${libPath}`);

	const name = platformPackageName(target);
	const directory = `${outDir}/${name}`;

	await rm(directory, { recursive: true, force: true });
	await mkdir(directory, { recursive: true });

	await Bun.write(`${directory}/${libName}`, Bun.file(libPath));

	// Windows has no rpath, so raylib.dll ships beside the shim that needs it.
	const sidecar = Bun.file(`${libPath.replace(libName, '')}raylib.dll`);
	if (await sidecar.exists()) await Bun.write(`${directory}/raylib.dll`, sidecar);

	const manifest = {
		name,
		version,
		description: `Prebuilt kreb raylib shim for ${target}.`,
		license: 'MIT',
		os: [os],
		cpu: [cpu],
		files: ['*.so', '*.dylib', '*.dll'],
	};

	await Bun.write(`${directory}/package.json`, `${JSON.stringify(manifest, null, '\t')}\n`);
	await Bun.write(
		`${directory}/README.md`,
		`# ${name}\n\nPrebuilt binary for kreb. Do not install directly.\n`,
	);

	return directory;
}

if (import.meta.main) {
	const version = process.argv[2];
	if (!version) throw new Error('usage: pack-platform.ts <version>');

	console.log(await packPlatform(version));
}
