import { currentTarget, currentTargetKey } from './targets.ts';

export function buildDir(): string {
	return new URL(`../build/${currentTargetKey()}/`, import.meta.url).pathname;
}

export function shimPath(name: string): string {
	return `${buildDir()}lib${name}.${currentTarget().sharedLibExtension}`;
}
