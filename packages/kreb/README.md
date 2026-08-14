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
bun packages/kreb/examples/demo.ts
```
