import { mkdir } from 'node:fs/promises';
import { RAYLIB_VERSION } from '../src/raylib-path.ts';

const SOURCE = `https://raw.githubusercontent.com/raysan5/raylib/${RAYLIB_VERSION}/tools/rlparser/output/raylib_api.json`;
const OUT = new URL('../vendor/raylib-api/raylib_api.json', import.meta.url).pathname;

const STRING_FIELD = /^(\s*"(?:description|name|type|returnType)":\s*")(.*)(",?)$/;

// rlparser emits string values verbatim, so a raylib description containing a
// double quote produces invalid JSON. raylib 6.0 has exactly one such line
// (LoadDirectoryFilesEx). The same defect is present in the XML and Lua output,
// so switching formats does not avoid it.
export function repairUnescapedQuotes(source: string): { text: string; repaired: number } {
	let repaired = 0;

	const lines = source.split('\n').map((line) => {
		const match = STRING_FIELD.exec(line);
		if (!match) return line;

		const [, head, value, tail] = match as unknown as [string, string, string, string];
		if (!value.includes('"')) return line;

		repaired += 1;
		return `${head}${value.replaceAll('"', '\\"')}${tail}`;
	});

	return { text: lines.join('\n'), repaired };
}

if (import.meta.main) {
	const response = await fetch(SOURCE);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${SOURCE}: ${response.status} ${response.statusText}`);
	}

	const { text, repaired } = repairUnescapedQuotes(await response.text());

	const api = JSON.parse(text);
	if (!Array.isArray(api.functions) || api.functions.length === 0) {
		throw new Error('Fetched API description has no functions');
	}

	await mkdir(OUT.split('/').slice(0, -1).join('/'), { recursive: true });
	await Bun.write(OUT, text);

	console.log(
		`vendored raylib ${RAYLIB_VERSION} API: ${api.structs.length} structs, ` +
			`${api.enums.length} enums, ${api.functions.length} functions ` +
			`(${repaired} malformed line(s) repaired)`,
	);
}
