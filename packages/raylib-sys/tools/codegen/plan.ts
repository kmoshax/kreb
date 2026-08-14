import { type ApiFunction, params } from './api.ts';
import { type Component, classify, needsOutParam, type TypeInfo } from './typemap.ts';

export type PlannedParam = {
	name: string;
	info: TypeInfo;
	flat: { name: string; c: string; ffi: string }[];
	callSiteArgument: string;
};

export type PlannedFunction = {
	name: string;
	shimName: string;
	returnInfo: TypeInfo;
	returnStructName: string | null;
	outComponents: Component[] | null;
	parameters: PlannedParam[];
};

export type SkippedFunction = {
	name: string;
	reason: string;
};

export type Plan = {
	functions: PlannedFunction[];
	skipped: SkippedFunction[];
};

const MATRIX_COMPONENTS: Component[] = Array.from({ length: 16 }, (_, i) => ({
	name: `m${i}`,
	c: 'float',
	ffi: 'f32' as const,
}));

function planParam(name: string, rawType: string): PlannedParam | { error: string } {
	const info = classify(rawType);

	switch (info.kind) {
		case 'scalar':
			return { name, info, flat: [{ name, c: info.c, ffi: info.ffi }], callSiteArgument: name };

		case 'cstring':
			return {
				name,
				info,
				flat: [{ name, c: 'const char *', ffi: 'cstring' }],
				callSiteArgument: name,
			};

		case 'color':
			return {
				name,
				info,
				flat: [{ name, c: 'uint32_t', ffi: 'u32' }],
				callSiteArgument: `kreb_color_from_rgba(${name})`,
			};

		case 'matrix':
			return {
				name,
				info,
				flat: [{ name, c: 'const float *', ffi: 'ptr' }],
				callSiteArgument: `kreb_matrix_from_floats(${name})`,
			};

		case 'value': {
			const flat = info.struct.components.map((component) => ({
				name: `${name}_${component.name}`,
				c: component.c,
				ffi: component.ffi,
			}));
			return {
				name,
				info,
				flat,
				callSiteArgument: info.struct.compose(flat.map((f) => f.name)),
			};
		}

		case 'handle':
			return {
				name,
				info,
				flat: [{ name, c: 'void *', ffi: 'ptr' }],
				callSiteArgument: `*(${info.struct} *)${name}`,
			};

		case 'pointer':
			return {
				name,
				info,
				flat: [{ name, c: 'void *', ffi: 'ptr' }],
				callSiteArgument: `(${info.c})${name}`,
			};

		case 'callback':
			return {
				name,
				info,
				flat: [{ name, c: 'void *', ffi: 'ptr' }],
				callSiteArgument: `(${info.c})${name}`,
			};

		case 'void':
			return { error: `parameter "${name}" has type void` };

		default:
			return { error: `parameter "${name}": ${info.reason}` };
	}
}

export function planFunction(fn: ApiFunction): PlannedFunction | SkippedFunction {
	const returnInfo = classify(fn.returnType);

	if (returnInfo.kind === 'unsupported') {
		return { name: fn.name, reason: `return ${returnInfo.reason}` };
	}

	const parameters: PlannedParam[] = [];

	for (const [index, param] of params(fn).entries()) {
		// rlparser emits unnamed params for a few declarations; index keeps them unique.
		const name = param.name?.trim() || `arg${index}`;
		const planned = planParam(name, param.type);

		if ('error' in planned) {
			return { name: fn.name, reason: planned.error };
		}

		parameters.push(planned);
	}

	const outComponents =
		returnInfo.kind === 'value'
			? returnInfo.struct.components
			: returnInfo.kind === 'matrix'
				? MATRIX_COMPONENTS
				: null;

	return {
		name: fn.name,
		shimName: `kreb_${fn.name}`,
		returnInfo,
		returnStructName: returnInfo.kind === 'value' ? returnInfo.struct.name : null,
		outComponents: needsOutParam(returnInfo) ? outComponents : null,
		parameters,
	};
}

export function planApi(functions: ApiFunction[]): Plan {
	const planned: PlannedFunction[] = [];
	const skipped: SkippedFunction[] = [];

	for (const fn of functions) {
		const result = planFunction(fn);
		if ('reason' in result) skipped.push(result);
		else planned.push(result);
	}

	return { functions: planned, skipped };
}
