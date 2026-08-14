export type FfiType = 'void' | 'i32' | 'u32' | 'f32' | 'f64' | 'i64' | 'ptr' | 'cstring';

export type Component = {
	name: string;
	c: string;
	ffi: FfiType;
};

export type ValueStruct = {
	name: string;
	components: Component[];
	/** Builds a C initializer for the struct from the flattened parameter names. */
	compose: (names: string[]) => string;
	/** Reads the struct's components out into a float array. */
	decompose: (value: string, out: string) => string;
};

export type TypeInfo =
	| { kind: 'void' }
	| { kind: 'scalar'; c: string; ffi: FfiType; raw: string }
	| { kind: 'cstring' }
	| { kind: 'color' }
	| { kind: 'value'; struct: ValueStruct }
	| { kind: 'matrix' }
	| { kind: 'handle'; struct: string }
	| { kind: 'pointer'; c: string }
	| { kind: 'callback'; c: string }
	| { kind: 'unsupported'; reason: string };

const SCALARS: Record<string, { c: string; ffi: FfiType }> = {
	bool: { c: 'int32_t', ffi: 'i32' },
	char: { c: 'int8_t', ffi: 'i32' },
	int: { c: 'int32_t', ffi: 'i32' },
	long: { c: 'int64_t', ffi: 'i64' },
	float: { c: 'float', ffi: 'f32' },
	double: { c: 'double', ffi: 'f64' },
	'unsigned int': { c: 'uint32_t', ffi: 'u32' },
	'unsigned char': { c: 'uint32_t', ffi: 'u32' },
};

export const ALIASES: Record<string, string> = {
	Quaternion: 'Vector4',
	Texture2D: 'Texture',
	TextureCubemap: 'Texture',
	RenderTexture2D: 'RenderTexture',
	Camera: 'Camera3D',
};

function floats(name: string, fields: string[]): ValueStruct {
	return {
		name,
		components: fields.map((f) => ({ name: f, c: 'float', ffi: 'f32' as const })),
		compose: (names) => `(${name}){${names.join(', ')}}`,
		decompose: (value, out) => fields.map((f, i) => `${out}[${i}] = ${value}.${f};`).join('\n    '),
	};
}

function nested(name: string, groups: [string, string[]][]): ValueStruct {
	const components = groups.flatMap(([group, fields]) =>
		fields.map((f) => ({ name: `${group}_${f}`, c: 'float', ffi: 'f32' as const })),
	);

	let index = 0;
	const reads: string[] = [];
	for (const [group, fields] of groups) {
		for (const f of fields) {
			reads.push(`OUT[${index}] = VALUE.${group}.${f};`);
			index += 1;
		}
	}

	return {
		name,
		components,
		compose: (names) => {
			let cursor = 0;
			const parts = groups.map(([, fields]) => {
				const slice = names.slice(cursor, cursor + fields.length);
				cursor += fields.length;
				return `{${slice.join(', ')}}`;
			});
			return `(${name}){${parts.join(', ')}}`;
		},
		decompose: (value, out) =>
			reads.map((r) => r.replaceAll('VALUE', value).replaceAll('OUT', out)).join('\n    '),
	};
}

const XYZ = ['x', 'y', 'z'];

export const VALUE_STRUCTS: Record<string, ValueStruct> = {
	Vector2: floats('Vector2', ['x', 'y']),
	Vector3: floats('Vector3', XYZ),
	Vector4: floats('Vector4', ['x', 'y', 'z', 'w']),
	Rectangle: floats('Rectangle', ['x', 'y', 'width', 'height']),
	Ray: nested('Ray', [
		['position', XYZ],
		['direction', XYZ],
	]),
	BoundingBox: nested('BoundingBox', [
		['min', XYZ],
		['max', XYZ],
	]),
	Transform: nested('Transform', [
		['translation', XYZ],
		['rotation', ['x', 'y', 'z', 'w']],
		['scale', XYZ],
	]),
	RayCollision: {
		name: 'RayCollision',
		components: [
			{ name: 'hit', c: 'float', ffi: 'f32' },
			{ name: 'distance', c: 'float', ffi: 'f32' },
			...['point_x', 'point_y', 'point_z', 'normal_x', 'normal_y', 'normal_z'].map((name) => ({
				name,
				c: 'float',
				ffi: 'f32' as const,
			})),
		],
		compose: (n) =>
			`(RayCollision){${n[0]} != 0.0f, ${n[1]}, {${n[2]}, ${n[3]}, ${n[4]}}, {${n[5]}, ${n[6]}, ${n[7]}}}`,
		decompose: (value, out) =>
			[
				`${out}[0] = ${value}.hit ? 1.0f : 0.0f;`,
				`${out}[1] = ${value}.distance;`,
				`${out}[2] = ${value}.point.x;`,
				`${out}[3] = ${value}.point.y;`,
				`${out}[4] = ${value}.point.z;`,
				`${out}[5] = ${value}.normal.x;`,
				`${out}[6] = ${value}.normal.y;`,
				`${out}[7] = ${value}.normal.z;`,
			].join('\n    '),
	},
};

// Structs that own GPU or heap resources, or that raylib mutates through a
// pointer. These live on the heap and cross the boundary as an opaque void*.
export const HANDLE_STRUCTS = new Set([
	'Image',
	'Texture',
	'RenderTexture',
	'Font',
	'GlyphInfo',
	'Shader',
	'Model',
	'Mesh',
	'Material',
	'MaterialMap',
	'ModelAnimation',
	'BoneInfo',
	'Sound',
	'Music',
	'Wave',
	'AudioStream',
	'Camera2D',
	'Camera3D',
	'NPatchInfo',
	'VrDeviceInfo',
	'VrStereoConfig',
	'AutomationEvent',
	'AutomationEventList',
	'FilePathList',
	'ModelSkeleton',
]);

const CALLBACKS = new Set([
	'AudioCallback',
	'LoadFileDataCallback',
	'LoadFileTextCallback',
	'SaveFileDataCallback',
	'SaveFileTextCallback',
	'TraceLogCallback',
]);

export function resolveAlias(type: string): string {
	return ALIASES[type] ?? type;
}

export function classify(rawType: string): TypeInfo {
	const type = rawType.trim();

	if (type === 'void') return { kind: 'void' };
	if (type === '...') return { kind: 'unsupported', reason: 'variadic' };

	if (type === 'const char *') return { kind: 'cstring' };

	// Any other pointer crosses as an opaque address; the caller owns the memory.
	if (type.includes('*')) return { kind: 'pointer', c: type };

	const scalar = SCALARS[type];
	if (scalar) return { kind: 'scalar', ...scalar, raw: type };

	if (CALLBACKS.has(type)) return { kind: 'callback', c: type };

	const resolved = resolveAlias(type);

	if (resolved === 'Color') return { kind: 'color' };
	if (resolved === 'Matrix') return { kind: 'matrix' };

	const value = VALUE_STRUCTS[resolved];
	if (value) return { kind: 'value', struct: value };

	if (HANDLE_STRUCTS.has(resolved)) return { kind: 'handle', struct: resolved };

	return { kind: 'unsupported', reason: `unmapped type "${rawType}"` };
}

/** Return types that need a trailing out-pointer rather than a C return value. */
export function needsOutParam(info: TypeInfo): boolean {
	return info.kind === 'value' || info.kind === 'matrix';
}

export function ffiReturnType(info: TypeInfo): FfiType {
	switch (info.kind) {
		case 'void':
			return 'void';
		case 'scalar':
			return info.ffi;
		case 'cstring':
			return 'ptr';
		case 'color':
			return 'u32';
		case 'handle':
		case 'pointer':
		case 'callback':
			return 'ptr';
		case 'value':
		case 'matrix':
			return 'void';
		default:
			return 'void';
	}
}
