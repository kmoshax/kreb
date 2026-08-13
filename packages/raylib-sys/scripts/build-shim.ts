import { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { raylibPaths } from "../src/raylib-path.ts";

export type ShimBuild = {
  libPath: string;
  compiled: boolean;
};

const SHARED_LIB_EXTENSION =
  process.platform === "darwin" ? "dylib" : process.platform === "win32" ? "dll" : "so";

export function buildDir(): string {
  return new URL(`../build/${process.platform}-${process.arch}/`, import.meta.url).pathname;
}

export async function buildShim(
  sources: string[],
  outName: string,
  { force = false }: { force?: boolean } = {},
): Promise<ShimBuild> {
  const paths = raylibPaths();

  if (!existsSync(`${paths.include}/raylib.h`)) {
    throw new Error(`raylib not found at ${paths.root}. Run the postinstall downloader first.`);
  }

  const dir = buildDir();
  await mkdir(dir, { recursive: true });
  const libPath = `${dir}lib${outName}.${SHARED_LIB_EXTENSION}`;

  if (!force && (await isUpToDate(libPath, sources))) {
    return { libPath, compiled: false };
  }

  // rpath, not LD_LIBRARY_PATH: the dynamic loader reads that only at process
  // start, so a caller importing kreb could never set it in time.
  const rpathFlag =
    process.platform === "darwin"
      ? `-Wl,-rpath,${paths.lib}`
      : `-Wl,-rpath,${paths.lib},--enable-new-dtags`;

  await $`cc -shared -fPIC -O2 -o ${libPath} ${sources} -I${paths.include} -L${paths.lib} -lraylib ${rpathFlag}`;

  return { libPath, compiled: true };
}

async function isUpToDate(libPath: string, sources: string[]): Promise<boolean> {
  const out = Bun.file(libPath);
  if (!(await out.exists())) return false;

  return sources.every((src) => Bun.file(src).lastModified <= out.lastModified);
}

if (import.meta.main) {
  const probe = new URL("../native/abi_probe.c", import.meta.url).pathname;
  const { libPath, compiled } = await buildShim([probe], "kreb_probe", { force: true });
  console.log(`${compiled ? "built" : "up to date"}: ${libPath}`);
}
