// Manual check: bun packages/raylib-sys/examples/window.ts
// Opens a real window, bounces a circle, closes on Escape.

import { buildShim } from '../scripts/build-shim.ts';

await buildShim([new URL('../native/kreb_shim.c', import.meta.url).pathname], 'kreb_raylib');

const rl = await import('../src/generated/raylib.ts');
const { DARKBLUE, MAROON, RAYWHITE } = await import('../src/generated/colors.ts');

const WIDTH = 800;
const HEIGHT = 450;
const RADIUS = 36;

rl.InitWindow(WIDTH, HEIGHT, 'kreb');
rl.SetTargetFPS(60);

const position = { x: WIDTH / 2, y: HEIGHT / 2 };
const velocity = { x: 260, y: 190 };

while (!rl.WindowShouldClose()) {
	const dt = rl.GetFrameTime();

	position.x += velocity.x * dt;
	position.y += velocity.y * dt;

	if (position.x < RADIUS || position.x > WIDTH - RADIUS) velocity.x *= -1;
	if (position.y < RADIUS || position.y > HEIGHT - RADIUS) velocity.y *= -1;

	rl.BeginDrawing();
	rl.ClearBackground(RAYWHITE);
	rl.DrawRectangleRec(0, 0, WIDTH, 48, DARKBLUE);
	rl.DrawText('kreb — press Escape to close', 16, 14, 20, RAYWHITE);
	rl.DrawCircleV(position.x, position.y, RADIUS, MAROON);
	rl.EndDrawing();
}

rl.CloseWindow();
