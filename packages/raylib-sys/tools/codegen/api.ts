export type ApiParam = { type: string; name: string };

export type ApiFunction = {
	name: string;
	description?: string;
	returnType: string;
	params?: ApiParam[];
};

export type ApiStruct = {
	name: string;
	fields: { type: string; name: string }[];
};

export type ApiEnum = {
	name: string;
	values: { name: string; value: number }[];
};

export type ApiDefine = {
	name: string;
	type: string;
	value: string | number;
};

export type RaylibApi = {
	defines: ApiDefine[];
	structs: ApiStruct[];
	aliases: { name: string; type: string }[];
	enums: ApiEnum[];
	callbacks: ApiFunction[];
	functions: ApiFunction[];
};

const API_PATH = new URL('../../vendor/raylib-api/raylib_api.json', import.meta.url).pathname;

export async function loadApi(path = API_PATH): Promise<RaylibApi> {
	const api = (await Bun.file(path).json()) as RaylibApi;

	for (const key of ['structs', 'enums', 'functions'] as const) {
		if (!Array.isArray(api[key]) || api[key].length === 0) {
			throw new Error(`API description at ${path} has no ${key}`);
		}
	}

	return api;
}

export function params(fn: ApiFunction): ApiParam[] {
	return fn.params ?? [];
}
