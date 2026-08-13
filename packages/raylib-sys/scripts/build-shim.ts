import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { $ } from 'bun';
import { raylibPaths } from '../src/raylib-path.ts';
import { buildDir, shimPath } from '../src/shim-path.ts';

export type ShimBuild = {
	libPath: string;
	compiled: boolean;
};

export async function buildShim(
	sources: string[],
	outName: string,
	{ force = false }: { force?: boolean } = {},
): Promise<ShimBuild> {
	const paths = raylibPaths();

	if (!existsSync(`${paths.include}/raylib.h`)) {
		throw new Error(`raylib not found at ${paths.root}. Run the postinstall downloader first.`);
	}

	await mkdir(buildDir(), { recursive: true });
	const libPath = shimPath(outName);

	if (!force && (await isUpToDate(libPath, sources))) {
		return { libPath, compiled: false };
	}

	if (process.platform === 'win32') {
		await compileWithMsvc(sources, libPath, paths);
	} else {
		await compileWithCc(sources, libPath, paths);
	}

	return { libPath, compiled: true };
}

async function compileWithCc(
	sources: string[],
	libPath: string,
	paths: ReturnType<typeof raylibPaths>,
): Promise<void> {
	// rpath, not LD_LIBRARY_PATH: the dynamic loader reads that only at process
	// start, so a caller importing kreb could never set it in time.
	const rpathFlag =
		process.platform === 'darwin'
			? `-Wl,-rpath,${paths.lib}`
			: `-Wl,-rpath,${paths.lib},--enable-new-dtags`;

	await $`cc -shared -fPIC -O2 -o ${libPath} ${sources} -I${paths.include} -L${paths.lib} -lraylib ${rpathFlag}`;
}

async function compileWithMsvc(
	sources: string[],
	libPath: string,
	paths: ReturnType<typeof raylibPaths>,
): Promise<void> {
	const objDir = `${buildDir()}obj/`;
	await mkdir(objDir, { recursive: true });

	// raylibdll.lib is the import library for raylib.dll; raylib.lib is the
	// static build and would pull the whole of raylib into the shim.
	await $`cl /nologo /LD /O2 /Fe:${libPath} /Fo:${objDir} ${sources} /I${paths.include} /link /LIBPATH:${paths.lib} raylibdll.lib`;

	// Windows has no rpath, so raylib.dll has to sit next to the shim.
	await copyFile(`${paths.lib}/raylib.dll`, `${buildDir()}raylib.dll`);
}

async function isUpToDate(libPath: string, sources: string[]): Promise<boolean> {
	const out = Bun.file(libPath);
	if (!(await out.exists())) return false;

	return sources.every((src) => Bun.file(src).lastModified <= out.lastModified);
}

if (import.meta.main) {
	const probe = new URL('../native/abi_probe.c', import.meta.url).pathname;
	const { libPath, compiled } = await buildShim([probe], 'kreb_probe', { force: true });

	console.log(`${compiled ? 'built' : 'up to date'}: ${libPath}`);
}
