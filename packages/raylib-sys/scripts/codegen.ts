import { mkdir } from 'node:fs/promises';
import { planAccessors, planWriters } from '../tools/codegen/accessors.ts';
import { loadApi } from '../tools/codegen/api.ts';
import { emitC } from '../tools/codegen/emit-c.ts';
import { emitBindings, emitColors, emitEnums } from '../tools/codegen/emit-ts.ts';
import { planApi } from '../tools/codegen/plan.ts';

const NATIVE = new URL('../native/', import.meta.url).pathname;
const GENERATED = new URL('../generated/', import.meta.url).pathname;

export async function generate(): Promise<{ generated: number; skipped: number }> {
	const api = await loadApi();
	const plan = planApi(api.functions);
	const accessors = planAccessors(api.structs);
	const writers = planWriters(api.structs);

	await mkdir(GENERATED, { recursive: true });

	await Bun.write(`${NATIVE}kreb_shim.c`, emitC(plan, accessors, writers));
	await Bun.write(`${GENERATED}raylib.ts`, emitBindings(plan, accessors, writers));
	await Bun.write(`${GENERATED}enums.ts`, emitEnums(api.enums));
	await Bun.write(`${GENERATED}colors.ts`, emitColors(api.defines));

	return { generated: plan.functions.length, skipped: plan.skipped.length };
}

if (import.meta.main) {
	const api = await loadApi();
	const plan = planApi(api.functions);
	const { generated, skipped } = await generate();

	console.log(`generated ${generated} functions, skipped ${skipped}`);

	// Never let coverage shrink silently: every omission is named.
	for (const entry of plan.skipped) {
		console.log(`  skipped ${entry.name}: ${entry.reason}`);
	}
}
