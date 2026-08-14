import { readdir } from 'node:fs/promises';
import { planManifest, renderManifest } from '../assets/manifest.ts';

const IGNORED_ENTRIES = new Set(['.DS_Store', 'Thumbs.db']);

export async function scanAssets(directory: string): Promise<string[]> {
	const found: string[] = [];

	async function walk(current: string, prefix: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.name.startsWith('.') || IGNORED_ENTRIES.has(entry.name)) continue;

			const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

			if (entry.isDirectory()) await walk(`${current}/${entry.name}`, relative);
			else found.push(relative);
		}
	}

	await walk(directory, '');
	return found;
}

export type ManifestResult = {
	written: boolean;
	count: number;
	ignored: string[];
};

/**
 * Skips the write when the content is unchanged, so `kreb dev` regenerating the
 * manifest does not touch the file and retrigger its own hot reload.
 */
export async function writeManifest(
	assetsDirectory: string,
	outputPath: string,
): Promise<ManifestResult> {
	const files = await scanAssets(assetsDirectory);
	const plan = planManifest(files);
	const source = renderManifest(plan, assetsDirectory);

	const target = Bun.file(outputPath);
	const current = (await target.exists()) ? await target.text() : null;

	if (current === source) {
		return { written: false, count: plan.entries.length, ignored: plan.ignored };
	}

	await Bun.write(outputPath, source);
	return { written: true, count: plan.entries.length, ignored: plan.ignored };
}
