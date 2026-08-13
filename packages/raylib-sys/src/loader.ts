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

	const path = shimPath(name);

	if (!existsSync(path)) {
		throw new Error(missingShimMessage(path));
	}

	const library = dlopen(path, symbols);
	loaded.set(name, library.symbols);

	return library.symbols;
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

	return `${cause}\n  Expected: ${path}\n  ${fix}`;
}

export { shimPath };
