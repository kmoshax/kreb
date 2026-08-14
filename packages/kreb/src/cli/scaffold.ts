export type ScaffoldFile = {
	path: string;
	contents: string;
};

const MAIN = `import { actions, Anchor, axis2, game, input, Key, Node2D, NodeUI, Scene } from 'kreb';
import type { Draw2D, DrawUI } from 'kreb';

const WIDTH = 960;
const HEIGHT = 540;

const Act = actions({
	move: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
	boost: Key.KEY_SPACE,
});

class Player extends Node2D {
	speed = 260;

	override update(dt: number): void {
		const direction = input.axis(Act.move);
		const speed = input.held(Act.boost) ? this.speed * 2.5 : this.speed;

		this.position.x += direction.x * speed * dt;
		this.position.y += direction.y * speed * dt;
	}

	override draw(g: Draw2D): void {
		g.circle({ x: 0, y: 0 }, 24, { color: 0xbe2137ff });
	}
}

class Hud extends NodeUI {
	override draw(g: DrawUI): void {
		g.text('WASD to move, space to boost', 0, 0, { size: 20, color: 0x000000ff });
	}
}

class Level extends Scene {
	override ready(): void {
		const player = this.add(new Player('player'));
		player.position.set({ x: WIDTH / 2, y: HEIGHT / 2 });

		const hud = this.add(new Hud('hud'));
		hud.anchor = Anchor.TopLeft;
		hud.offset = { x: 16, y: 16, width: 320, height: 24 };
	}
}

export default game({
	window: { width: WIDTH, height: HEIGHT, title: '<name>', targetFps: 60 },
	scenes: { level: Level },
	start: 'level',
});
`;

const TSCONFIG = `{
	"compilerOptions": {
		"lib": ["ESNext"],
		"target": "ESNext",
		"module": "Preserve",
		"moduleDetection": "force",
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"verbatimModuleSyntax": true,
		"noEmit": true,
		"strict": true,
		"skipLibCheck": true,
		"noUncheckedIndexedAccess": true,
		"noImplicitOverride": true,
		"types": ["bun"]
	}
}
`;

const GITIGNORE = `node_modules
src/generated
`;

const README = `# <name>

    bun install
    bun run dev

\`kreb dev\` regenerates \`src/generated/assets.ts\` from the \`assets/\` directory
and runs the game with hot reload. Drop files into \`assets/\` and reference them
through \`Assets\`, never by path string.
`;

export function scaffold(name: string): ScaffoldFile[] {
	const substitute = (text: string) => text.replaceAll('<name>', name);

	const packageJson = {
		name,
		private: true,
		type: 'module',
		scripts: {
			dev: 'kreb dev',
			build: 'kreb build',
			typecheck: 'tsc --noEmit',
		},
		dependencies: { kreb: 'workspace:*' },
	};

	return [
		{ path: 'package.json', contents: `${JSON.stringify(packageJson, null, '\t')}\n` },
		{ path: 'tsconfig.json', contents: TSCONFIG },
		{ path: '.gitignore', contents: GITIGNORE },
		{ path: 'README.md', contents: substitute(README) },
		{ path: 'src/main.ts', contents: substitute(MAIN) },
		{ path: 'assets/.gitkeep', contents: '' },
	];
}
