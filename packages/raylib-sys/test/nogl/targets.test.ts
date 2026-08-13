import { expect, test } from 'bun:test';
import { RAYLIB_VERSION } from '../../src/raylib-path.ts';
import { currentTarget, currentTargetKey, TARGETS } from '../../src/targets.ts';

const SUPPORTED = [
	'linux-x64',
	'linux-arm64',
	'darwin-x64',
	'darwin-arm64',
	'win32-x64',
	'win32-arm64',
];

test('every supported target has an entry', () => {
	expect(Object.keys(TARGETS).sort()).toEqual(SUPPORTED.sort());
});

test('every asset name carries the pinned version', () => {
	for (const [key, target] of Object.entries(TARGETS)) {
		expect(target.asset, key).toContain(RAYLIB_VERSION);
	}
});

test('every digest is a sha-256 hex string', () => {
	for (const [key, target] of Object.entries(TARGETS)) {
		expect(target.sha256, key).toMatch(/^[0-9a-f]{64}$/);
	}
});

test('the running platform resolves to a target', () => {
	const key = currentTargetKey();
	const target = TARGETS[key];
	if (!target) throw new Error(`no target entry for ${key}`);

	expect(currentTarget()).toBe(target);
});
