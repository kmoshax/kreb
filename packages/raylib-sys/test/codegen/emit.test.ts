import { expect, test } from 'bun:test';
import type { ApiFunction } from '../../tools/codegen/api.ts';
import { emitC } from '../../tools/codegen/emit-c.ts';
import { emitBindings, emitColors, emitEnums } from '../../tools/codegen/emit-ts.ts';
import { planApi } from '../../tools/codegen/plan.ts';

function generate(functions: ApiFunction[]) {
	const plan = planApi(functions);
	return { c: emitC(plan), ts: emitBindings(plan), plan };
}

test('a void function with scalar and color parameters', () => {
	const { c, ts } = generate([
		{
			name: 'DrawPixel',
			returnType: 'void',
			params: [
				{ type: 'int', name: 'posX' },
				{ type: 'int', name: 'posY' },
				{ type: 'Color', name: 'color' },
			],
		},
	]);

	expect(c).toContain(
		'void kreb_DrawPixel(int32_t posX, int32_t posY, uint32_t color) {\n' +
			'    DrawPixel(posX, posY, kreb_color_from_rgba(color));\n}',
	);
	expect(ts).toContain("\tkreb_DrawPixel: { args: ['i32', 'i32', 'u32'], returns: 'void' },");
	expect(ts).toContain(
		'export function DrawPixel(posX: number, posY: number, color: number): void {\n' +
			'\tsymbols.kreb_DrawPixel(posX, posY, color);\n}',
	);
});

test('a value struct parameter flattens into components', () => {
	const { c, ts } = generate([
		{
			name: 'DrawCircleV',
			returnType: 'void',
			params: [
				{ type: 'Vector2', name: 'center' },
				{ type: 'float', name: 'radius' },
				{ type: 'Color', name: 'color' },
			],
		},
	]);

	expect(c).toContain(
		'void kreb_DrawCircleV(float center_x, float center_y, float radius, uint32_t color)',
	);
	expect(c).toContain(
		'DrawCircleV((Vector2){center_x, center_y}, radius, kreb_color_from_rgba(color));',
	);
	expect(ts).toContain('export function DrawCircleV(center_x: number, center_y: number');
});

test('a value struct return uses a trailing out pointer', () => {
	const { c, ts } = generate([{ name: 'GetMousePosition', returnType: 'Vector2' }]);

	expect(c).toContain('void kreb_GetMousePosition(float *kreb_out) {');
	expect(c).toContain('Vector2 kreb_value = GetMousePosition();');
	expect(c).toContain('kreb_out[0] = kreb_value.x;');
	expect(ts).toContain("\tkreb_GetMousePosition: { args: ['ptr'], returns: 'void' },");
	expect(ts).toContain('\treturn scratch.slice(0, 2);');
});

test('a nested value struct composes and decomposes by group', () => {
	const { c } = generate([
		{
			name: 'GetScreenToWorldRay',
			returnType: 'Ray',
			params: [
				{ type: 'Vector2', name: 'position' },
				{ type: 'Camera', name: 'camera' },
			],
		},
	]);

	expect(c).toContain(
		'void kreb_GetScreenToWorldRay(float position_x, float position_y, void *camera, float *kreb_out)',
	);
	expect(c).toContain('kreb_out[3] = kreb_value.direction.x;');
	expect(c).toContain('*(Camera3D *)camera');
});

test('a handle return is heap allocated', () => {
	const { c, ts } = generate([
		{
			name: 'LoadTexture',
			returnType: 'Texture2D',
			params: [{ type: 'const char *', name: 'fileName' }],
		},
	]);

	expect(c).toContain('void *kreb_LoadTexture(const char *fileName) {');
	expect(c).toContain('Texture *kreb_result = (Texture *)malloc(sizeof(Texture));');
	expect(c).toContain('*kreb_result = LoadTexture(fileName);');
	expect(ts).toContain('export function LoadTexture(fileName: string): Pointer | null {');
	expect(ts).toContain('\treturn symbols.kreb_LoadTexture(cstring(fileName));');
});

test('bool crosses as int32 and surfaces as boolean', () => {
	const { c, ts } = generate([
		{
			name: 'IsKeyDown',
			returnType: 'bool',
			params: [{ type: 'int', name: 'key' }],
		},
	]);

	expect(c).toContain(
		'int32_t kreb_IsKeyDown(int32_t key) {\n    return (int32_t)IsKeyDown(key);\n}',
	);
	expect(ts).toContain('export function IsKeyDown(key: number): boolean {');
	expect(ts).toContain('\treturn symbols.kreb_IsKeyDown(key) === 1;');
});

test('a matrix parameter arrives as a float pointer', () => {
	const { c, ts } = generate([
		{
			name: 'SetShaderValueMatrix',
			returnType: 'void',
			params: [{ type: 'Matrix', name: 'mat' }],
		},
	]);

	expect(c).toContain('void kreb_SetShaderValueMatrix(const float *mat)');
	expect(c).toContain('SetShaderValueMatrix(kreb_matrix_from_floats(mat));');
	expect(ts).toContain('export function SetShaderValueMatrix(mat: Float32Array): void {');
	expect(ts).toContain('\tsymbols.kreb_SetShaderValueMatrix(ptr(mat));');
});

test('variadic functions are skipped with a named reason', () => {
	const { plan } = generate([
		{
			name: 'TraceLog',
			returnType: 'void',
			params: [
				{ type: 'int', name: 'logLevel' },
				{ type: '...', name: 'args' },
			],
		},
	]);

	expect(plan.functions).toEqual([]);
	expect(plan.skipped).toEqual([{ name: 'TraceLog', reason: 'parameter "args": variadic' }]);
});

test('enums emit as const objects with a value union', () => {
	const output = emitEnums([{ name: 'TraceLogLevel', values: [{ name: 'LOG_ALL', value: 0 }] }]);

	expect(output).toContain('export const TraceLogLevel = {\n\tLOG_ALL: 0,\n} as const;');
	expect(output).toContain(
		'export type TraceLogLevel = (typeof TraceLogLevel)[keyof typeof TraceLogLevel];',
	);
});

test('colors emit packed as rgba', () => {
	const output = emitColors([
		{ name: 'RAYWHITE', type: 'COLOR', value: 'CLITERAL(Color){ 245, 245, 245, 255 }' },
		{ name: 'DEG2RAD', type: 'FLOAT', value: '(PI/180.0f)' },
	]);

	expect(output).toContain('export const RAYWHITE = 0xf5f5f5ff;');
	expect(output).not.toContain('DEG2RAD');
});
