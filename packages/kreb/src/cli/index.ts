import { mkdir } from 'node:fs/promises';
import { buildShim } from '@kreb/raylib-sys/build';
import { scaffold } from './scaffold.ts';
import { writeManifest } from './scan.ts';

const SHIM_SOURCE = new URL('../../../raylib-sys/native/kreb_shim.c', import.meta.url).pathname;
const SHIM_NAME = 'kreb_raylib';

const ASSETS_DIRECTORY = 'assets';
const MANIFEST_PATH = 'src/generated/assets.ts';
const ENTRY = 'src/main.ts';
const RUNNER = new URL('./runner.ts', import.meta.url).pathname;

export type CommandResult = {
	code: number;
	message?: string;
};

const USAGE = `kreb <command>

  new <name>   scaffold a project
  build        regenerate the asset manifest and native shim
  dev          build, then run the game with hot reload
  run          build, then run the game once
`;

export async function newProject(name: string | undefined): Promise<CommandResult> {
	if (!name) return { code: 1, message: 'kreb new needs a project name' };

	const target = `${process.cwd()}/${name}`;
	if (await Bun.file(`${target}/package.json`).exists()) {
		return { code: 1, message: `${name}/package.json already exists` };
	}

	for (const file of scaffold(name)) {
		await Bun.write(`${target}/${file.path}`, file.contents);
	}

	return { code: 0, message: `created ${name}\n  cd ${name} && bun install && bun run dev` };
}

export async function build(): Promise<CommandResult> {
	if (!(await Bun.file(ENTRY).exists())) {
		return { code: 1, message: `No ${ENTRY} here. Run kreb from a project root.` };
	}

	await mkdir(MANIFEST_PATH.split('/').slice(0, -1).join('/'), { recursive: true });

	const manifest = await writeManifest(ASSETS_DIRECTORY, MANIFEST_PATH);
	await buildShim([SHIM_SOURCE], SHIM_NAME);

	const lines = [`${manifest.count} assets${manifest.written ? '' : ' (unchanged)'}`];

	// Surfacing skipped files beats silently pretending the directory was empty.
	if (manifest.ignored.length > 0) {
		lines.push(`ignored ${manifest.ignored.length}: ${manifest.ignored.join(', ')}`);
	}

	return { code: 0, message: lines.join('\n') };
}

async function launch(hot: boolean): Promise<CommandResult> {
	const prepared = await build();
	if (prepared.code !== 0) return prepared;

	if (prepared.message) console.log(prepared.message);

	const entry = `${process.cwd()}/${ENTRY}`;
	const args = hot ? ['bun', '--hot', RUNNER, entry] : ['bun', RUNNER, entry];
	const child = Bun.spawn(args, { stdio: ['inherit', 'inherit', 'inherit'] });

	return { code: await child.exited };
}

export async function run(argv: string[]): Promise<CommandResult> {
	const [command, ...rest] = argv;

	switch (command) {
		case 'new':
			return newProject(rest[0]);
		case 'build':
			return build();
		case 'dev':
			return launch(true);
		case 'run':
			return launch(false);
		case undefined:
		case '--help':
		case '-h':
			return { code: 0, message: USAGE };
		default:
			return { code: 1, message: `Unknown command "${command}".\n\n${USAGE}` };
	}
}
