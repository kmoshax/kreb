import { dlopen, type FFIFunction, type Library } from 'bun:ffi';
import { existsSync } from 'node:fs';
import { RAYLIB_VERSION, raylibPaths } from './raylib-path.ts';
import { shimPath } from './shim-path.ts';
import { currentTargetKey } from './targets.ts';

const loaded = new Map<string, unknown>();

export function loadShim<const Symbols extends Record<string, FFIFunction>>(
	name: string,
	symbols: Symbols,
): Library<Symbols>['symbols'] {
	const cached = loaded.get(name);
	if (cached) return cached as Library<Symbols>['symbols'];

	const path = resolveShim(name);

	if (path === null) {
		throw new Error(missingShimMessage(shimPath(name)));
	}

	const library = dlopen(path, symbols);
	loaded.set(name, library.symbols);

	return library.symbols;
}

/**
 * A published install finds the shim in its per-platform package; a checkout
 * finds the one the local build produced. Development wins so an edited shim is
 * picked up without uninstalling anything.
 */
function resolveShim(name: string): string | null {
	const local = shimPath(name);
	if (existsSync(local)) return local;

	const target = currentTargetKey();

	try {
		const manifest = Bun.resolveSync(`kreb-${target}/package.json`, import.meta.dir);
		const directory = manifest.slice(0, manifest.lastIndexOf('/'));
		const packaged = `${directory}/${local.slice(local.lastIndexOf('/') + 1)}`;

		return existsSync(packaged) ? packaged : null;
	} catch {
		return null;
	}
}

function missingShimMessage(path: string): string {
	const target = currentTargetKey();
	const raylibInstalled = existsSync(`${raylibPaths().include}/raylib.h`);

	const cause = raylibInstalled
		? `The prebuilt shim for ${target} is missing.`
		: `raylib ${RAYLIB_VERSION} has not been downloaded for ${target}.`;

	const fix = raylibInstalled
		? `Build it with: bun run --filter @kreb/raylib-sys build:shim`
		: `Run: bun run --filter @kreb/raylib-sys postinstall`;

	return [cause, `  Looked for: ${path}`, `  and in the package kreb-${target}`, `  ${fix}`].join(
		'\n',
	);
}

export { shimPath };
