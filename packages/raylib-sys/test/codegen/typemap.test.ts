import { expect, test } from 'bun:test';
import { loadApi } from '../../tools/codegen/api.ts';
import { planApi } from '../../tools/codegen/plan.ts';
import { classify, HANDLE_STRUCTS, VALUE_STRUCTS } from '../../tools/codegen/typemap.ts';

const api = await loadApi();
const structNames = new Set(api.structs.map((s) => s.name));

// Color and Matrix have bespoke handling rather than a value-struct entry.
const SPECIAL_CASED = new Set(['Color', 'Matrix']);

test('every struct in the API is classified', () => {
	const unclassified = api.structs
		.map((s) => s.name)
		.filter(
			(name) => !VALUE_STRUCTS[name] && !HANDLE_STRUCTS.has(name) && !SPECIAL_CASED.has(name),
		);

	expect(unclassified).toEqual([]);
});

test('no handle refers to a struct raylib does not define', () => {
	const invented = [...HANDLE_STRUCTS].filter((name) => !structNames.has(name));

	expect(invented).toEqual([]);
});

test('no value struct refers to a struct raylib does not define', () => {
	const invented = Object.keys(VALUE_STRUCTS).filter((name) => !structNames.has(name));

	expect(invented).toEqual([]);
});

test('value struct component counts match the C layout', () => {
	const expected: Record<string, number> = {
		Vector2: 2,
		Vector3: 3,
		Vector4: 4,
		Rectangle: 4,
		Ray: 6,
		BoundingBox: 6,
		Transform: 10,
		RayCollision: 8,
	};

	for (const [name, struct] of Object.entries(VALUE_STRUCTS)) {
		expect(struct.components.length, name).toBe(expected[name] as number);
	}
});

test('aliases resolve to their underlying struct', () => {
	expect(classify('Texture2D')).toEqual(classify('Texture'));
	expect(classify('Quaternion')).toEqual(classify('Vector4'));
	expect(classify('Camera')).toEqual(classify('Camera3D'));
});

test('only the variadic functions are skipped', () => {
	const plan = planApi(api.functions);

	expect(plan.skipped.map((s) => s.name).sort()).toEqual(['TextFormat', 'TraceLog']);
	expect(plan.functions.length).toBe(api.functions.length - 2);
});
