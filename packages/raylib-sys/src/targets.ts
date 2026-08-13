export type TargetKey = `${NodeJS.Platform}-${string}`;

export type Target = {
	asset: string;
	sha256: string;
	sharedLibExtension: 'so' | 'dylib' | 'dll';
};

// Digests come from the GitHub release asset metadata for the pinned version.
// Regenerate them alongside any RAYLIB_VERSION bump or the downloader will
// reject every archive.
export const TARGETS: Record<string, Target> = {
	'linux-x64': {
		asset: 'raylib-6.0_linux_amd64.tar.gz',
		sha256: 'b64ba618a19e7da9e9c0e09bb398ecfd477a77d2d7231901bafc8739d27c08d2',
		sharedLibExtension: 'so',
	},
	'linux-arm64': {
		asset: 'raylib-6.0_linux_arm64.tar.gz',
		sha256: 'd39ca0b36fe865b41b058a5646576e6b98b4875352502b41ed303f2c38a39ec9',
		sharedLibExtension: 'so',
	},
	'darwin-x64': {
		asset: 'raylib-6.0_macos.tar.gz',
		sha256: '6ae5947fbd36aee4c280e3a2b3e1893316c433e292bda6e94e0f2b037498ad70',
		sharedLibExtension: 'dylib',
	},
	'darwin-arm64': {
		asset: 'raylib-6.0_macos.tar.gz',
		sha256: '6ae5947fbd36aee4c280e3a2b3e1893316c433e292bda6e94e0f2b037498ad70',
		sharedLibExtension: 'dylib',
	},
	'win32-x64': {
		asset: 'raylib-6.0_win64_msvc16.zip',
		sha256: 'c93c7dc74576e00e3ee57fa2bd5fd109fbfc5aca87e12046dd7ec2c2268b3f78',
		sharedLibExtension: 'dll',
	},
	'win32-arm64': {
		asset: 'raylib-6.0_winarm64_msvc16.zip',
		sha256: 'ecd21693c5fd760ce1efc52745882e98fa61e0d3ecac36ec2271c60e245849b1',
		sharedLibExtension: 'dll',
	},
};

export function currentTargetKey(): string {
	return `${process.platform}-${process.arch}`;
}

export function currentTarget(): Target {
	const key = currentTargetKey();
	const target = TARGETS[key];

	if (!target) {
		throw new Error(
			`kreb does not support ${key}. Supported targets: ${Object.keys(TARGETS).join(', ')}.`,
		);
	}

	return target;
}
