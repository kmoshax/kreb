// Manual check:
//   bun packages/kreb/examples/basra/server.ts     # in one terminal, for online play
//   bun packages/kreb/examples/basra/main.ts       # in another
//
// Basra (باصرة), the Egyptian kotchena game. Rules and the match model are
// plain TypeScript in rules.ts and match.ts; the relay in server.ts is a dumb
// message pipe. This file only wires the shell together.

import { game } from 'kreb';
import { Palette } from './art.ts';
import { SCREEN } from './chrome.ts';
import { MainMenu } from './menus.ts';

game({
	window: { ...SCREEN, title: 'kreb — basra', targetFps: 60 },
	scenes: { menu: MainMenu },
	start: 'menu',
	clearColor: Palette.feltEdge,
}).run();
