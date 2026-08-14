// Rewrites every workspace package to one version, including cross-package
// dependency ranges and the optional platform packages, so a release cannot
// ship a kreb that asks for a shim version nobody published.

import { Glob } from 'bun';

const version = process.argv[2];
if (!version) throw new Error('usage: set-version.ts <version>');
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
	throw new Error(`"${version}" is not a semver version`);
}

const workspaceNames = new Set<string>();
const manifests: string[] = [];

for await (const path of new Glob('packages/*/package.json').scan('.')) {
	manifests.push(path);
	workspaceNames.add((await Bun.file(path).json()).name);
}

for (const path of manifests) {
	const manifest = await Bun.file(path).json();
	manifest.version = version;

	for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
		const block = manifest[field];
		if (!block) continue;

		for (const name of Object.keys(block)) {
			if (workspaceNames.has(name) || name.startsWith('kreb-')) block[name] = version;
		}
	}

	await Bun.write(path, `${JSON.stringify(manifest, null, '\t')}\n`);
	console.log(`${manifest.name} -> ${version}`);
}
