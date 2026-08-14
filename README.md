# kreb

A game framework for [Bun](https://bun.com), built on [raylib](https://www.raylib.com). 2D and 3D, TypeScript-first.

kreb is a **framework, not a library**. It owns the entry point, the main loop, the frame, resource lifetime, and the build workflow. You declare; kreb sequences.

```bash
bunx kreb new my-game
cd my-game && bun install && bun run dev
```

## What a game looks like

```ts
import { actions, Anchor, axis2, game, input, Key, Node2D, NodeUI, Scene } from 'kreb'
import type { Draw2D, DrawUI } from 'kreb'

const Act = actions({
  move: axis2({ up: Key.KEY_W, down: Key.KEY_S, left: Key.KEY_A, right: Key.KEY_D }),
})

class Player extends Node2D {
  update(dt: number) {
    const dir = input.axis(Act.move)
    this.position.x += dir.x * 260 * dt
    this.position.y += dir.y * 260 * dt
  }

  draw(g: Draw2D) {
    g.circle({ x: 0, y: 0 }, 24, { color: 0xbe2137ff })
  }
}

class Hud extends NodeUI {
  draw(g: DrawUI) {
    g.text('hello from kreb', 0, 0, { size: 20 })
  }
}

class Level extends Scene {
  ready() {
    this.add(new Player('player')).position.set({ x: 480, y: 270 })

    const hud = this.add(new Hud('hud'))
    hud.anchor = Anchor.TopLeft
    hud.offset = { x: 16, y: 16, width: 240, height: 24 }
  }
}

export default game({
  window: { width: 960, height: 540, title: 'my-game', targetFps: 60 },
  scenes: { level: Level },
  start: 'level',
})
```

There is no `while (!windowShouldClose())`. There is no `BeginDrawing()`. Your entry exports a game and `kreb dev` runs it.

## Ideas the design commits to

**Drawing into the wrong space does not compile.** raylib requires 3D draws inside `BeginMode3D`, 2D world draws inside `BeginMode2D`, and UI outside both. Rather than document that, kreb hands each node a context typed for its own space — `Node2D.draw` receives `Draw2D`, `Node3D.draw` receives `Draw3D`. There is no global draw function, and the `Begin*` calls are not in the public API at all. Traversal collects drawables into buckets and the buckets execute in the correct order, so a HUD parented under a 3D enemy still draws last.

**No strings for structure.** No node paths, no signal names, no component keys. Asset paths come from a manifest generated from your `assets/` directory, so renaming a file is a compile error. Input actions and state machine transitions are declared values whose targets are type-checked.

**Nothing nullable in the hot path.** Overlap queries return empty arrays. `raycast` returns `{ hit: false }` rather than null. Failed asset loads throw with the resource named instead of handing back a dead handle that silently draws nothing.

**Composition is plain fields.** No attach API, no component registry, no `getComponent` that might return undefined — TypeScript already has composition. Colliders and particle emitters are the exception, because the framework has to discover them.

## Packages

| Package | What it is |
| --- | --- |
| `kreb` | the framework and CLI |
| `@kreb/math` | raymath ported to TypeScript, no native dependency |
| `@kreb/raylib-sys` | the raylib FFI layer, private |

`@kreb/raylib-sys` is internal and has no public entrypoint. kreb ships **no escape hatch** to raw raylib, which means every capability a game needs has to become first-class framework API.

## CLI

```
kreb new <name>   scaffold a project
kreb build        regenerate the asset manifest and native shim
kreb dev          build, then run with hot reload
kreb run          build, then run once
```

## Development

```bash
bun install
bun test
bun run typecheck
bun run check          # biome lint + format
bun packages/kreb/examples/demo.ts
```

The native shim is compiled from `packages/raylib-sys/native/` by the system C compiler. Contributors need one; users do not.

Regenerating bindings after a raylib version bump:

```bash
bun run --filter @kreb/raylib-sys vendor:api
bun run --filter @kreb/raylib-sys codegen
```

## Known limits

- **Collision is detection only.** No mass, restitution, or solver. Wrapping Rapier is the path if dynamics is ever wanted.
- **Asset loading is synchronous.** raylib's loaders block and texture upload needs the GL context on the main thread, so kreb yields on a per-frame time budget rather than pretending to be async.
- **The struct-ABI probes have only run on linux-x64** locally. CI runs them on all six targets; until that has run, aarch64 and Windows struct layouts are assumed rather than verified.
- **Hot reload covers assets and behavior**, not full state preservation. Code-only authoring means there is no serialization format to rebuild a live scene from.
- **UI is deliberately small** — panel, label, button, checkbox, slider, single-line text input. Enough for menus and HUDs, not a general toolkit.

Design documents live in `docs/superpowers/specs/`.

## License

MIT
