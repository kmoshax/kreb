# kreb

The framework. See the [repository README](../../README.md) for the overview and a full example.

```
kreb new <name>   scaffold a project
kreb build        regenerate the asset manifest and native shim
kreb dev          build, then run with hot reload
kreb run          build, then run once
```

## Layout

| Path | What lives there |
| --- | --- |
| `src/core/` | loop, `Node`/`Node2D`/`Node3D`/`NodeUI`, cameras, transforms, render queue |
| `src/draw/` | `Draw2D`, `Draw3D`, `DrawUI` — the typed drawing contexts |
| `src/scene/` | `Scene`, `SceneManager` |
| `src/assets/` | budgeted loader, reference-counted cache, scopes, manifest generator |
| `src/input/` | actions, axes, fixed-step edge latching |
| `src/collision/` | shapes, spatial hash, queries, layers |
| `src/ui/` | widgets, focus, anchor layout |
| `src/extras/` | tweens, timers, particles, state machines |
| `src/cli/` | `new`, `build`, `dev`, `run` |

## Running the examples

```bash
bun packages/kreb/examples/demo.ts        # 2D + 3D + UI in one scene
bun packages/kreb/examples/pong.ts        # input, collision, tweens
bun packages/kreb/examples/basra/main.ts  # a card game, rules split from rendering
```

`basra/` is the fullest example — a complete game with menus and online play:

| File | What it holds |
| --- | --- |
| `rules.ts` | capture, scoring, opponent policy. No framework import |
| `match.ts` | deck, hands, turn order, per-seat views. No framework import |
| `protocol.ts` | the messages the relay and clients agree on |
| `server.ts` | `Bun.serve` room relay. Run it for online play |
| `net.ts` | client socket, buffering events for the fixed step |
| `controllers.ts` | AI, host and guest behind one interface |
| `chrome.ts` | shared menu furniture |
| `menus.ts` | title, settings, online lobby |
| `table.ts` | the playing surface, pause and results |

Online play is host-authoritative: the guest asks to play a card, the host
resolves it and broadcasts a view. A dropped or reordered message can never
desync the two screens.

```bash
bun packages/kreb/examples/basra/server.ts   # terminal one
bun packages/kreb/examples/basra/main.ts     # terminal two, and again for player two
```
