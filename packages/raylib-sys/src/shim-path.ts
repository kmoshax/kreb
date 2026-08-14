import { currentTarget, currentTargetKey } from './targets.ts';

export function buildDir(): string {
	return new URL(`../build/${currentTargetKey()}/`, import.meta.url).pathname;
}

export function shimPath(name: string): string {
	return `${buildDir()}lib${name}.${currentTarget().sharedLibExtension}`;
}

// Absolute paths to the C sources, so no caller has to guess a relative path
// into this package. These are file locations, not module specifiers, so an
// import alias cannot express them.
export const SHIM_SOURCE = new URL('../native/kreb_shim.c', import.meta.url).pathname;
export const ABI_PROBE_SOURCE = new URL('../native/abi_probe.c', import.meta.url).pathname;
export const RAYMATH_PROBE_SOURCE = new URL('../native/raymath_probe.c', import.meta.url).pathname;
