// Spawned by `kreb dev` and `kreb run`. The framework owns main: a project
// entry exports a game and never starts the loop itself.

const [entry] = process.argv.slice(2);

if (!entry) throw new Error('kreb runner needs an entry path');

const module = await import(entry);
const game = module.default;

if (!game || typeof game.run !== 'function') {
	throw new Error(`${entry} must "export default game({ ... })" from kreb`);
}

game.run();
