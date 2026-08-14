import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { newProject, run } from '../src/cli/index.ts';
import { scaffold } from '../src/cli/scaffold.ts';
import { writeManifest } from '../src/cli/scan.ts';

let workspace: string;
const originalCwd = process.cwd();

beforeAll(async () => {
	workspace = await mkdtemp(`${tmpdir()}/kreb-cli-`);
});

afterAll(async () => {
	process.chdir(originalCwd);
	await rm(workspace, { recursive: true, force: true });
});

test('scaffold produces a runnable project shape', () => {
	const files = scaffold('my-game');
	const paths = files.map((file) => file.path).sort();

	expect(paths).toEqual([
		'.gitignore',
		'README.md',
		'assets/.gitkeep',
		'package.json',
		'src/main.ts',
		'tsconfig.json',
	]);

	const pkg = files.find((file) => file.path === 'package.json');
	expect(JSON.parse(pkg?.contents ?? '{}').name).toBe('my-game');

	const main = files.find((file) => file.path === 'src/main.ts');
	expect(main?.contents).toContain("title: 'my-game'");
	expect(main?.contents).toContain('export default game(');
});

test('the scaffolded entry never reaches past the framework', () => {
	const main = scaffold('x').find((file) => file.path === 'src/main.ts');

	expect(main?.contents).toContain("from 'kreb'");
	expect(main?.contents).not.toContain('raylib-sys');
});

test('kreb new writes the project and refuses to overwrite it', async () => {
	process.chdir(workspace);

	const created = await newProject('demo');
	expect(created.code).toBe(0);
	expect(await Bun.file(`${workspace}/demo/src/main.ts`).exists()).toBe(true);

	const again = await newProject('demo');
	expect(again.code).toBe(1);
	expect(again.message).toContain('already exists');
});

test('kreb new without a name fails with guidance', async () => {
	const result = await newProject(undefined);

	expect(result.code).toBe(1);
	expect(result.message).toContain('needs a project name');
});

test('the manifest is written from a real directory and skipped when unchanged', async () => {
	const project = `${workspace}/demo`;
	await Bun.write(`${project}/assets/player.png`, 'not really a png');
	await Bun.write(`${project}/assets/music/theme.ogg`, 'not really an ogg');
	await Bun.write(`${project}/assets/readme.txt`, 'ignored');

	const manifest = `${project}/src/generated/assets.ts`;

	const first = await writeManifest(`${project}/assets`, manifest);
	expect(first.written).toBe(true);
	expect(first.count).toBe(2);
	expect(first.ignored).toEqual(['readme.txt']);

	const source = await Bun.file(manifest).text();
	expect(source).toContain('player:');
	expect(source).toContain('music_theme:');

	// Rewriting would touch mtime and retrigger hot reload for no reason.
	const second = await writeManifest(`${project}/assets`, manifest);
	expect(second.written).toBe(false);
});

test('an unknown command explains itself', async () => {
	const result = await run(['wat']);

	expect(result.code).toBe(1);
	expect(result.message).toContain('Unknown command "wat"');
	expect(result.message).toContain('new <name>');
});

test('help exits cleanly', async () => {
	const result = await run(['--help']);

	expect(result.code).toBe(0);
	expect(result.message).toContain('kreb <command>');
});

test('build outside a project says so instead of guessing', async () => {
	process.chdir(workspace);

	const result = await run(['build']);

	expect(result.code).toBe(1);
	expect(result.message).toContain('src/main.ts');
});
