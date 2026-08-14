# kreb game framework — design

**Date:** 2026-08-14
**Status:** Approved. Phases 5-8 complete; phases 9-12 not yet started.
**Scope:** The kreb framework itself. The raylib FFI layer beneath it is designed separately in `2026-08-14-kreb-raylib-binding-design.md`.

## What kreb is

kreb is a game framework for Bun, built on raylib, supporting 2D and 3D from the first release.

It is a **framework, not a library**. Inversion of control is the organising principle: kreb owns the entry point, the main loop, the frame, resource lifetime, and the build workflow. Users declare; kreb sequences. There is no user-written game loop.

Games are authored **in code only**. There is no scene serialization format, no visual editor, and no reflection over node properties. This removes stable node identifiers, an inspector protocol, and a data format from the design entirely.

There is **no escape hatch**. The raylib binding layer is private and unreachable from user code. Every capability a real game needs must ship as first-class framework API.

## DX invariants

These are binding on every API in the framework and serve as the review checklist for any addition.

1. **No strings for structure.** No node paths, no signal names, no component keys, no asset path lookups at the point of use. Strings are for text the player sees.
2. **No nullable returns in the hot path.** Getting a child, an asset, or a camera either succeeds or throws an error naming the fix. Optionals are reserved for genuinely optional things.
3. **One way to do each thing.** Every "you can also…" is a DX defect until proven otherwise.
4. **No magic method names.** Lifecycle hooks are declared on a base class or interface, discoverable by autocomplete, never matched by string.
5. **Resources have owners.** Every handle belongs to a scene, a node, or a `using` block. There is no global cache with unclear lifetime.
6. **Errors name the object and the fix**, not the internal invariant. For example: `Cannot draw Sprite "player": texture disposed at scene exit. Load it in this scene's assets.`
7. **Autocomplete is the documentation.** If discovering an API requires the documentation site, the API is wrong.

Invariants 2 and 3 will be uncomfortable in practice. Invariant 2 rules out the forgiving null-returning lookups that Unity users expect. Invariant 3 will eventually mean refusing a convenience wrapper that someone reasonably wants. Both are accepted deliberately.

### What these are reacting to

| Engine | The DX failure | kreb's answer |
| --- | --- | --- |
| Godot | `get_node("../../Player")` — structural strings; renaming breaks at runtime with no compiler help | typed direct references |
| Unity | `GetComponent<T>()` returns null; string-matched `Update()`; opaque execution order | no nullable lookups in the hot path; explicit, visible call order |
| Unity, Godot | untyped signals — `emit("died", args)` | typed event objects, checked at compile time |
| Three.js | dispose hell; resource leaks are silent and normal | ownership plus dispose guards from the binding layer; leaks warn loudly |
| Phaser | a god object — everything hangs off `this.scene.add.*` | no central registry object |
| Love2D | no structure at all | a scene tree, with optional depth |

The common thread is stringly-typed structure and nullable lookups. Both are fully solvable in TypeScript and neither is solvable in GDScript or C# as those engines are shaped. That is kreb's actual opening — not a nicer API surface, but a type system the incumbents cannot retrofit.

## Render passes and draw contexts

This is the central architectural decision, and it falls out of supporting 2D and 3D simultaneously.

raylib requires bracketing: 3D draws must occur inside `BeginMode3D`/`EndMode3D`, 2D world draws inside `BeginMode2D`/`EndMode2D`, and UI outside both. A depth-first traversal that draws as it walks cannot produce that ordering — a 2D health bar parented to a 3D enemy would emit its draw call in the middle of the 3D pass.

So traversal collects rather than draws. Each drawable is bucketed by its own node type, then buckets execute in a fixed order:

```
WORLD_3D   BeginMode3D(camera3d) … EndMode3D    sorted by material, then depth
WORLD_2D   BeginMode2D(camera2d) … EndMode2D    sorted by zIndex
UI         screen space, no camera              sorted by zIndex
```

Buckets are reused arrays cleared each frame rather than reallocated. This design also provides 2D z-sorting, which a direct-draw tree cannot do at all, and gives frustum culling a natural home later.

Correct usage is then enforced by the type system. Three context types exist, each handed to the node by the framework during the matching pass. None are constructible by user code, and there is no global draw function.

```ts
class Player extends Node2D {
  update(dt: number) {
    this.position.x += this.speed * dt
    // no draw API is reachable here
  }

  draw(g: Draw2D) {
    g.sprite(this.tex, this.position)
    // g.screenRect(...) does not exist on Draw2D — compile error
  }
}

class Enemy extends Node3D {
  draw(g: Draw3D) { g.model(this.mesh) }
}

class Hud extends NodeUI {
  draw(g: DrawUI) { g.text("Score", 10, 10) }
}
```

Drawing outside `draw()`, drawing into the wrong space, and forgetting `BeginDrawing`/`EndDrawing` are all unrepresentable. `BeginDrawing`, `EndDrawing`, and `BeginMode*` do not appear in the public API.

State changes use scoped methods rather than push/pop pairs, so a bracket cannot be left unbalanced:

```ts
interface Draw2D {
  sprite(tex: Texture, at: Vector2, opts?: SpriteOpts): void
  text(s: string, at: Vector2, opts?: TextOpts): void
  line(a: Vector2, b: Vector2, opts?: StrokeOpts): void
  rect(r: Rect, opts?: FillOpts): void
  withShader(s: Shader, body: (g: Draw2D) => void): void
  withBlend(m: BlendMode, body: (g: Draw2D) => void): void
}
```

`Draw3D` and `DrawUI` follow the same shape with their own primitives.

## Nodes

```ts
abstract class Node {
  name: string
  readonly children: readonly Node[]
  readonly parent: Node | null

  ready(): void          // once, after entering the tree
  update(dt: number): void   // fixed timestep
  exitTree(): void
  destroy(): void        // recursive; disposes owned handles
}

class Node2D extends Node {
  position: Vector2; rotation: number; scale: Vector2; zIndex: number
  draw(g: Draw2D): void
}

class Node3D extends Node {
  position: Vector3; rotation: Quaternion; scale: Vector3
  draw(g: Draw3D): void
}

class NodeUI extends Node {
  anchor: Anchor; offset: Rect; zIndex: number
  draw(g: DrawUI): void
}
```

Cameras are nodes too — `Camera2D extends Node2D` and `Camera3D extends Node3D`, each wrapping a binding-layer camera handle and driving it from its own world transform. A scene designates one active camera per world space; the render pass reads them when opening `BeginMode2D` and `BeginMode3D`. Making cameras nodes means a camera can be parented to a player and inherit its transform for free, and it keeps the "no central registry" rule intact.

`Scene` is itself a node type — the root of the tree, owning the asset scope, the tween runner, the collision world, and the active camera references. Its lifecycle hooks match `Node`.

The hierarchy is deliberately shallow: one abstract base, three concrete node types plus cameras and `Scene`, with no deeper chain.

World transforms compose from the parent and are cached behind a dirty flag that propagates to descendants on mutation. For 3D this matters more than it appears — raylib's `DrawModelEx` takes position, axis, angle, and scale, which cannot express a nested or sheared hierarchy. kreb writes the composed matrix into `model.transform` and calls `DrawModel`, which is the only route that makes arbitrary 3D nesting correct.

A `Node2D` may parent a `Node3D` and the reverse. Bucket assignment follows the node's own type, not its ancestors'.

## Composition is plain fields

There is no attach API, no component registry, and no lookup by token.

```ts
class Enemy extends Node3D {
  health = new Health(100)
  blink  = new Blinker(0.2)

  update(dt: number) {
    this.blink.update(dt)
    if (this.health.dead) this.destroy()
  }

  draw(g: Draw3D) { g.model(this.mesh, { tint: this.blink.tint }) }
}

enemy.health.damage(10)
```

TypeScript already has composition; it does not need a framework registry to provide it. Removing the component system deletes the attach and detach API, the registry, behavior lifecycle wiring, execution-order rules, and every lookup that could return undefined. The cost is that the owner calls `this.blink.update(dt)` explicitly — one visible line replacing hidden machinery, which also makes update order readable in the source instead of framework-defined.

This is the DRY tradeoff made deliberately: the small repetition of forwarding `update` is cheaper than a subsystem that exists to eliminate it.

**Colliders and particle emitters are the exception** — they are nodes rather than plain fields, because the framework must discover them to run broadphase and to batch draws, and a plain field is invisible to it. Making them nodes means the traversal that buckets drawables also collects them, with no registry and no reflection. When the alternative to a small inconsistency is a hidden subsystem, the inconsistency is preferable.

## Main loop

Fixed-timestep accumulator with clamped delta time, variable render rate:

```
accumulate real dt, clamped so a debugger pause cannot spiral
while (acc >= STEP) { update(STEP); acc -= STEP }
render(alpha = acc / STEP)
```

Fixed update keeps movement and collision deterministic and framerate-independent. `alpha` is passed to the render pass so nodes can interpolate between previous and current transforms, but v1 does not interpolate by default — that doubles transform storage and is a drop-in addition once there is a real game to judge the jitter against.

## Scenes and entry point

A scene is a root node plus an asset scope. Assets loaded under a scene's scope are released when it exits, which is what prevents texture and model handles leaking across level transitions. `SceneManager` supports `change(scene)` plus `push`/`pop`, so a pause menu or inventory overlays the running scene without tearing it down.

```ts
// src/main.ts
export default kreb.game({
  window: { width: 1280, height: 720, title: "kreb" },
  scenes: { menu: MenuScene, level1: Level1 },
  start: "menu",
})
```

The CLI owns the workflow: `kreb new`, `kreb dev` (hot reload configured for you), `kreb build`, `kreb ship`. Users never assemble Bun flags by hand. Project layout is fixed by convention — `src/scenes/`, `src/entities/`, `assets/` — so the asset pipeline knows where things are with no path configuration.

## Hot reload

Scoped to **assets and behavior code**, not full state preservation. Swapping a sprite or an update function keeps positions and the running scene alive. Preserving arbitrary live state across a module swap would require the framework to serialize the node graph, and code-only authoring means there is no serialization format to do it with. Full state preservation is explicitly out of scope.

## Assets

Two constraints shape this. raylib's loaders are synchronous and blocking, texture upload requires the OpenGL context on the main thread, and Bun's FFI calls are synchronous. A `Promise`-returning asset API would therefore be theatre — the frame blocks regardless.

v1 uses a **budgeted loader**: during a loading screen kreb loads until a per-frame time budget is spent, then yields so the window stays responsive and progress animates. True background decode — decoding pixels in a Worker and uploading on the main thread — is a later optimization with a clear seam.

Asset paths are not strings at the point of use. `kreb dev` scans `assets/` and generates a typed manifest:

```ts
import { Assets } from "kreb/generated"

class Level1 extends Scene {
  tex = this.assets.load(Assets.textures.player)
  // Assets.textures.playr — compile error, no such file
}
```

Renaming a file becomes a compile error rather than a runtime crash, satisfying invariant 1 at the one place every other engine leaks strings.

Assets are scene-scoped by default with reference counting, so a texture shared by two scenes survives the transition and releases at zero. A `global` scope exists for assets that outlive all scenes, such as fonts and the UI atlas.

## Input

Actions are declared values, never strings:

```ts
export const Act = kreb.actions({
  jump: [Key.Space, Pad.A],
  move: kreb.axis2({ up: Key.W, down: Key.S, left: Key.A, right: Key.D }, Pad.LeftStick),
})

if (input.pressed(Act.jump)) this.velocity.y = JUMP
const dir = input.axis(Act.move)   // Vector2, deadzone applied
```

**Fixed timestep breaks naive edge detection**, and handling it correctly is a requirement rather than a refinement. raylib polls input once per frame, but `update` may run zero, one, or several times within that frame. Polled naively, a jump either fires repeatedly or is swallowed entirely. kreb latches edges per frame and delivers `pressed` on exactly the first fixed step that observes it, carrying unconsumed edges to the next step rather than dropping them. This class of bug is invisible until someone plays at 30fps, and it is untestable by hand — it is covered by headless tests.

## Collision

**No rigid-body dynamics in v1.** No mass, no restitution, no solver. Detection, queries, and callbacks only. A dynamics engine is a project comparable in size to the rest of the framework; wrapping Rapier's WebAssembly build is the sensible path if it is ever wanted. Stating this now prevents "physics" from meaning two different things later.

```ts
class Player extends Node2D {
  body = new BoxCollider2D(this, { size: { x: 16, y: 32 }, layer: Layer.Player })

  onEnter(other: Collider2D) {
    if (other.layer === Layer.Hazard) this.health.damage(10)
  }
}
```

Shapes are AABB, circle, and ray in 2D, and AABB, sphere, ray, and mesh in 3D. One spatial-hash broadphase is parameterized over dimension rather than duplicated. Layers and masks are typed bitflags. Queries such as `raycast` and `overlap` return typed hits, and "nothing hit" is an empty result rather than null.

## UI

kreb draws its own widgets using `DrawUI` primitives. raygui is not used.

raygui is immediate-mode with global styling and C-side widget state. Under a retained `NodeUI` tree, kreb owns layout, anchoring, focus, and event routing regardless, so raygui would contribute only pixels and hit-testing — both of which would then need duplicating to agree with kreb's layout. It is also the largest single source of TinyCC risk in the binding layer, since compiling it means compiling roughly 5000 lines of `RAYGUI_IMPLEMENTATION`.

The cost is real: layout, focus, keyboard navigation, and text input are kreb's to build. v1 stays deliberately small — panel, label, button, slider, checkbox, single-line text input, and anchor-based layout. That is enough for menus, HUDs, and settings screens, and is explicitly not a general-purpose UI toolkit.

## Extras

**Tweens** use a callback form rather than property-name strings:

```ts
this.tweens.run(0.5, Ease.OutQuad, t => {
  this.position.x = lerp(startX, endX, t)
})
```

The conventional `tween(obj, { x: 100 })` API requires string property keys and loses type safety on nested paths. The callback is simpler, fully typed, and can drive anything — a color, a shader uniform, or several values at once. The scene owns the runner and ticks it.

**Timers** are plain fields (`timer = new Timer(2.0)`) ticked by their owner, consistent with the composition rule.

**Particle emitters** are nodes, for the discovery reason given above. 2D emitters batch through `Draw2D`; 3D emitters use billboards.

**State machines** are typed transition tables with no string states:

```ts
const state = kreb.fsm({
  idle:     { onJump: "airborne" },
  airborne: { onLand: "idle" },
})
```

**Math** ships as its own package, `@kreb/math` — `raymath` reimplemented in pure TypeScript covering vectors, matrices, and quaternions. This avoids an FFI crossing per call and is strictly faster than binding header-only inline C. It is separate rather than a framework folder because it has no native dependency at all: no shim, no raylib download, no GPU. That makes it independently testable and usable on its own.

## Package layout

```
packages/raylib-sys/     private, never published, no public entrypoint
                         (see the binding layer design document)

packages/kreb-math/      @kreb/math — raymath port, pure TypeScript, no native
                         dependency, so it stands alone and is usable without
                         a window or a GPU

packages/kreb/           public
  src/core/              loop, Node, Node2D, Node3D, NodeUI, transforms, render passes
  src/draw/              Draw2D, Draw3D, DrawUI
  src/scene/             Scene, SceneManager
  src/assets/            budgeted loader, scopes, reference counting
  src/input/             actions, edge latching, gamepad
  src/collision/         shapes, spatial hash, queries, layers
  src/ui/                widgets, anchor layout, focus
  src/extras/            tweens, timers, particles, FSM
  src/cli/               new, dev, build, ship
  bin/kreb
```

Bun workspaces. The raylib split exists because the binding has a genuinely different build story — codegen, native source, a postinstall downloader, a platform matrix — and folding that into the framework's test loop would slow down every framework change.

## Testing

**Headless logic tests** cover more of this framework than expected, and are where the subtle bugs live: transform composition, dirty-flag propagation, render-pass bucketing and sort order, input edge latching across varying fixed-step counts, asset reference counting and scope release, the spatial hash, collision queries, tweens, the FSM, and math parity against C raymath. None of this needs a window or a GPU.

**Golden-image tests** cover the renderer: draw a fixed scene into a `RenderTexture`, export it, and compare against a committed reference PNG within a tolerance. This runs under `xvfb` with Mesa on Linux CI. It is the only way to catch a render-pass ordering regression, and it requires `RenderTexture2D` to be bound during binding-layer phase 3.

Linux CI runs everything. macOS and Windows run the logic tier only. The README states this rather than implying uniform coverage.

## Phases

Binding phases 0 through 4 are specified in the binding layer design document. Framework phases follow, continuing the same numbering.

| Phase | Deliverable | Complete when |
| --- | --- | --- |
| 5 | **Done.** raymath in pure TypeScript | 146 functions ported; parity verified against C raymath through a probe shim |
| 6 | **Done.** Core: loop, nodes, transforms, render passes, draw contexts, scenes | demo runs a bouncing sprite, two orbiting 3D cubes and a HUD in one frame; 30 framework tests |
| 7 | **Done.** Assets, CLI, typed manifest | `kreb new` scaffolds, `kreb build` generates the manifest, `kreb dev`/`run` launch through the framework's own runner; verified end to end outside the repo |
| 8 | **Done.** Input actions and edge latching | a press reaches exactly one fixed step at 30fps, and an edge seen during a stepless frame is carried rather than dropped |
| 9 | Collision | 2D and 3D queries, callbacks, and layers |
| 10 | Native UI | the demo has a menu and a settings screen |
| 11 | Extras | tweens, timers, particles, FSM |
| 12 | Documentation, examples, publish | |

Phase 6 is the real milestone — the first point at which kreb is a thing rather than a plan. Everything before it is infrastructure, and the earlier phases should be optimized for reaching phase 6 rather than for completeness.

## Risks

1. **~~Binding phase 0 can invalidate the approach.~~ Resolved 2026-08-14.** TinyCC's struct ABI turned out to be broken on x86_64, not merely uncertain on aarch64 — it mishandles every struct containing floats and nearly every struct return, which covers `Vector2`, `Vector3`, and `Rectangle`. The prebuilt-shim fallback was taken and verified. The residual cost is a six-target CI build matrix; the framework design is unaffected. Details in the binding layer document.
2. **No escape hatch makes coverage mandatory.** Custom shaders, render textures, blend modes, scissor, custom meshes, instancing, and skeletal animation must all ship as first-class API. This generates work continuously after v1 — it is a permanent tax rather than a phase.
3. **The project is large.** Twelve phases, of which native UI and the full 3D API surface are each sizable on their own. The scope was chosen deliberately; it is recorded here so the timeline is not a surprise.

## Decisions deliberately deferred

- Transform interpolation between fixed steps. Storage is designed to accommodate it; v1 does not implement it.
- True background asset decode using Workers. The budgeted loader provides the seam.
- Rigid-body dynamics, most likely via Rapier.
- rlgl bindings, if and when a framework feature requires them.
- Allocation-free hot-path draw variants, pending profiling evidence that they are needed.
