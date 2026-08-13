import { homedir } from 'node:os';

// Changing this without regenerating vendor/raylib-api breaks struct layouts silently.
export const RAYLIB_VERSION = '6.0';

export type RaylibPaths = {
	root: string;
	include: string;
	lib: string;
};

export function raylibPaths(): RaylibPaths {
	const root = `${homedir()}/.cache/kreb/raylib-${RAYLIB_VERSION}-${process.platform}-${process.arch}`;

	return {
		root,
		include: `${root}/include`,
		lib: `${root}/lib`,
	};
}
