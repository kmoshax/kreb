import type { ApiStruct } from './api.ts';
import { classify, HANDLE_STRUCTS, resolveAlias, VALUE_STRUCTS } from './typemap.ts';

export type Accessor =
	| { kind: 'scalar'; struct: string; field: string; c: string; ffi: string }
	| { kind: 'color'; struct: string; field: string }
	| { kind: 'ref'; struct: string; field: string }
	| { kind: 'value'; struct: string; field: string; valueStruct: string; components: number };

export function planAccessors(structs: ApiStruct[]): Accessor[] {
	const accessors: Accessor[] = [];

	for (const struct of structs) {
		if (!HANDLE_STRUCTS.has(struct.name)) continue;

		for (const field of struct.fields) {
			// Fixed-size array members have no single natural JS shape; the raw
			// handle pointer plus a bespoke reader is the honest way to reach them.
			if (field.type.includes('[')) continue;

			const info = classify(field.type);

			if (info.kind === 'scalar') {
				accessors.push({
					kind: 'scalar',
					struct: struct.name,
					field: field.name,
					c: info.c,
					ffi: info.ffi,
				});
				continue;
			}

			if (info.kind === 'color') {
				accessors.push({ kind: 'color', struct: struct.name, field: field.name });
				continue;
			}

			if (info.kind === 'value') {
				accessors.push({
					kind: 'value',
					struct: struct.name,
					field: field.name,
					valueStruct: info.struct.name,
					components: info.struct.components.length,
				});
				continue;
			}

			// Nested handle structs are reachable as an interior pointer, which
			// keeps the parent as the owner and avoids a second allocation.
			const resolved = resolveAlias(field.type);
			if (HANDLE_STRUCTS.has(resolved) || resolved === 'Matrix') {
				accessors.push({ kind: 'ref', struct: struct.name, field: field.name });
			}
		}
	}

	return accessors;
}

export function accessorName(accessor: Accessor): string {
	const prefix = accessor.kind === 'ref' ? 'kreb_ref' : 'kreb_get';
	return `${prefix}_${accessor.struct}_${accessor.field}`;
}

export function emitAccessorsC(accessors: Accessor[]): string {
	return accessors
		.map((accessor) => {
			const name = accessorName(accessor);
			const self = `((${accessor.struct} *)handle)`;

			switch (accessor.kind) {
				case 'scalar':
					return `${accessor.c} ${name}(void *handle) {\n    return (${accessor.c})${self}->${accessor.field};\n}`;

				case 'color':
					return `uint32_t ${name}(void *handle) {\n    return kreb_color_to_rgba(${self}->${accessor.field});\n}`;

				case 'ref':
					return `void *${name}(void *handle) {\n    return &${self}->${accessor.field};\n}`;

				case 'value': {
					const value = VALUE_STRUCTS[accessor.valueStruct];
					if (!value) throw new Error(`no value struct named ${accessor.valueStruct}`);

					const decompose = value.decompose(`${self}->${accessor.field}`, 'kreb_out');
					return `void ${name}(void *handle, float *kreb_out) {\n    ${decompose}\n}`;
				}
			}
		})
		.join('\n\n');
}

export function emitAccessorsSymbols(accessors: Accessor[]): string[] {
	return accessors.map((accessor) => {
		const name = accessorName(accessor);

		switch (accessor.kind) {
			case 'scalar':
				return `\t${name}: { args: ['ptr'], returns: '${accessor.ffi}' },`;
			case 'color':
				return `\t${name}: { args: ['ptr'], returns: 'u32' },`;
			case 'ref':
				return `\t${name}: { args: ['ptr'], returns: 'ptr' },`;
			case 'value':
				return `\t${name}: { args: ['ptr', 'ptr'], returns: 'void' },`;
		}
	});
}
