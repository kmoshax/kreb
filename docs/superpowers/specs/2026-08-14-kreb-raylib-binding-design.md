# kreb raylib binding layer — design

**Date:** 2026-08-14
**Status:** Approved, not yet implemented
**Scope:** Layer 0 of kreb — the FFI binding between Bun and raylib. The kreb game framework is designed separately in `2026-08-14-kreb-framework-design.md`.

## Purpose

kreb is a game framework for Bun built on raylib. This document specifies the layer underneath it: a Bun FFI binding that exposes raylib to TypeScript.

This layer is **internal**. It is never published as a public package and has no public entrypoint. kreb ships no escape hatch to raw raylib, so nothing outside the framework imports this layer. Its only consumer is `packages/kreb`.

That constraint sets the coverage requirement. Because users cannot reach past the framework, any raylib capability a real game needs must eventually be bound here and surfaced as framework API. Coverage is driven by framework need, not by completeness for its own sake.

## The core problem

raylib passes structs by value throughout its API — `Vector2`, `Vector3`, `Color`, `Rectangle`, `Camera2D`, `Camera3D`. Bun's `dlopen` supports only scalars and pointers. It cannot pass or return a struct by value, which rules out a direct `dlopen` binding for a large fraction of raylib.

The solution is a C shim layer that flattens every struct into scalars or pointers at the JavaScript boundary. The shim is compiled at runtime by `cc` from `bun:ffi`, which uses TinyCC.

## Architecture

```
vendor/raylib-api/*.json      pinned raylib 5.5 API description, committed
        │  codegen runs at development time; output is committed
        ▼
native/kreb_shim.c            flat C wrappers — no struct-by-value at the JS boundary
src/generated/*.ts            FFI symbol tables, typed wrappers, enums, constants
        │  at import time
        ▼
cc({ source, library: ["raylib"], flags: ["-I…", "-L…"], symbols })
        │  links against
        ▼
~/.cache/kreb/raylib-5.5-<platform>/{include,lib}    fetched by postinstall
```

Codegen output is committed rather than generated at install time. Diffs are reviewable, installs stay offline apart from the raylib download, and a bad codegen change cannot silently break users.

## ABI mapping

`tools/codegen/typemap.ts` is the single source of truth for this table. Both the C emitter and the TypeScript emitter read it, so the two sides cannot drift.

| raylib C type | Shim signature | TypeScript surface |
| --- | --- | --- |
| `Vector2` | `float x, float y` | `{x, y}` |
| `Vector3` | `float x, float y, float z` | `{x, y, z}` |
| `Vector4`, `Quaternion` | four `float` | `{x, y, z, w}` |
| `Color` | `uint32_t` packed RGBA | `{r, g, b, a}` |
| `Rectangle` | `float x, y, width, height` | `{x, y, width, height}` |
| `Matrix` | `const float*` (16 elements) | `Float32Array` |
| returns `Vector2`/`Vector3`/`Rectangle` | trailing `float* out` | unpacked from scratch buffer |
| returns `Color` | returns `uint32_t` | `{r, g, b, a}` |
| resource structs | heap-allocated, `void*` | opaque handle class |
| `const char*` return | `cstring` | `string` |
| function pointer args | `void*` | `JSCallback` |

Resource structs are `Texture2D`, `RenderTexture2D`, `Image`, `Font`, `Shader`, `Model`, `Mesh`, `Material`, `ModelAnimation`, `Sound`, `Music`, `Wave`, `AudioStream`, `Camera2D`, and `Camera3D`.

Cameras are handles rather than value objects because raylib mutates them through pointers — `UpdateCamera(&camera, mode)`. Representing a camera as a JavaScript value object would silently discard those mutations.

Struct returns unpack through one module-level scratch `Float32Array`. The shim writes into it and JavaScript reads the values out before any other call can run. This is safe because the runtime is single-threaded.

## Runtime compilation

`cc` from `bun:ffi` accepts `source`, `library`, `flags`, `define`, and `symbols`. kreb compiles the shim on first import of the binding module, linking against the downloaded `libraylib` via `library: ["raylib"]` plus `-I` and `-L` flags pointing at the cache directory.

TinyCC compiles quickly enough that a shim of this size adds only milliseconds to startup. If measurement later shows otherwise, the fallback is to precompile to a shared library using the system compiler when one is available and cache the result.

## Primary risk: TinyCC struct ABI

Struct-by-value never reaches JavaScript, but it does cross the boundary between the TinyCC-compiled shim and the GCC- or Clang-compiled `libraylib`. TinyCC must implement SysV and AAPCS struct passing exactly. The x86_64 path is well exercised; aarch64 and Windows are considerably less proven.

Phase 0 exists to resolve this before any other work. It probes:

- a shim function taking `Vector2` by value and echoing its components back
- a shim function returning `Color` by value from raylib (`GetColor`, `Fade`)
- `DrawRectangleRec` — `Rectangle` occupies two SSE registers while `Color` occupies one general-purpose register, which is the most demanding common case

Phase 0 also verifies, rather than assumes, that raylib's GitHub releases publish assets for every target platform. If a `linux_arm64` asset does not exist, that platform needs a source build or is dropped from v1.

If the probes fail on a platform that matters, the fallback is prebuilt shims produced by CI for that platform only. The codegen and TypeScript layers are unaffected either way, which is what makes the risk survivable rather than fatal.

## raylib acquisition

A postinstall script downloads the official raylib release archive for the current platform and architecture, verifies it against a pinned SHA-256, and unpacks `include/` and `lib/` into `~/.cache/kreb/raylib-<version>-<platform>/`. The version is pinned in the repository alongside the vendored API JSON.

A test asserts that the downloaded raylib's `RAYLIB_VERSION` matches the vendored API description. Silent skew between the two would produce incorrect struct layouts with no error, which is the worst available failure mode.

## Resource handles

```ts
class Texture2D {
  readonly ptr: Pointer
  get width(): number
  get height(): number
  get id(): number
  [Symbol.dispose](): void
}
```

Rules:

- Every handle carries a disposed flag. Use after dispose throws an error naming the resource, rather than passing a dangling pointer into OpenGL and crashing the process.
- Double dispose is a no-op.
- There is no `FinalizationRegistry` auto-unload. Garbage collection timing is nondeterministic, and unloading a texture is an OpenGL call — running one after `CloseWindow` is a hard crash. In development mode only, a `FinalizationRegistry` warns about handles collected while still live, so leaks are visible without being fatal.
- `Load*` functions throw on failure rather than returning a zero-id handle. raylib's convention of `texture.id == 0` silently no-ops on draw; throwing surfaces the problem at the call site.

## Module scope

**In scope for v1:** all of `raylib.h` as described by `raylib_api.json` — core, shapes, textures, text, models, and audio.

**Explicitly excluded from v1:**

- **rlgl.** Its only purpose is exposing low-level rendering to end users. With no escape hatch it has no consumer except the framework's own internals, which do not currently need it. Bind it if and when a framework feature requires it.
- **raygui.** The framework draws its UI natively. Binding raygui would also require TinyCC to compile roughly 5000 lines of `RAYGUI_IMPLEMENTATION`, which is a far larger compile surface than the shim and the largest single source of TinyCC risk.
- **raymath.** It is header-only inline C. It is reimplemented in pure TypeScript in the framework package, which avoids an FFI crossing per call and is strictly faster than binding it.

## Package layout

```
packages/raylib-sys/
  vendor/raylib-api/raylib_api.json
  tools/codegen/
    load-api.ts        parse and validate the API description
    typemap.ts         the ABI table above — single source of truth
    emit-c.ts          emits native/kreb_shim.c
    emit-ts.ts         emits src/generated/*.ts
    __snapshots__/     golden output
  native/
    kreb_shim.c        GENERATED, committed
    abi_probe.c        hand-written, phase 0, retained as regression tests
  src/
    loader.ts          locate raylib, invoke cc, cache the handle
    handles.ts         handle base class, dispose, use-after-free guard
    scratch.ts         shared struct-return buffer
    generated/raylib.ts, enums.ts, colors.ts
  scripts/
    postinstall.ts     download and verify the raylib release
    codegen.ts
  test/codegen/  test/nogl/  test/gl/
```

The package is private and has no public entrypoint.

## Testing

**`test/codegen/`** is pure and runs anywhere with no raylib present. API description fragments go through the emitters and the output is compared against committed golden files. This is where the ABI table gets its coverage, and it catches mapping regressions immediately.

**`test/nogl/`** requires `libraylib` but no window or GPU. This tier is larger than it first appears: CPU image operations (`LoadImage`, `ImageResize`, `ImageCrop`, `ExportImage`), color math (`GetColor`, `ColorToInt`, `Fade`, `ColorFromHSV`), file and compression utilities, and `Wave` decoding. The phase 0 ABI probes live here permanently — struct round-trips are exactly what breaks silently across a TinyCC or raylib version bump.

**`test/gl/`** requires a display. It covers `InitWindow`, drawing a frame, `LoadTextureFromImage`, reading back pixels, and `CloseWindow`. On Linux CI it runs under `xvfb-run` with Mesa llvmpipe.

macOS and Windows CI run the codegen and nogl tiers only. Headless OpenGL on those runners is more trouble than it is worth, and the ABI risk they carry is already covered by the nogl struct probes. The README states this rather than implying uniform coverage.

## Phases

| Phase | Deliverable | Complete when |
| --- | --- | --- |
| 0 | ABI spike: `abi_probe.c`, manual `cc` invocation, platform asset check | struct round-trips are correct on target platforms, or a fallback decision is documented |
| 1 | `postinstall.ts` and `loader.ts` | a clean machine installs raylib into the cache and `cc` links against it |
| 2 | Hand-written shim of roughly 15 functions: window, input, `ClearBackground`, `DrawText`, `DrawCircleV` | a window opens, text renders, Escape closes it |
| 3 | Codegen replaces the hand-written shim; full `raylib.h` | generated output passes phase 2's tests unchanged |
| 4 | Resource handles | textures, models, and audio load, draw, and dispose; use after dispose throws |

Phase 2 exists separately from phase 3 deliberately. It is cheap, and it means that when generated code first fails, the loader, the download, and the ABI are already known good, so the bug is in the emitter.

`RenderTexture2D` must be bound during phase 3 — the framework's golden-image tests depend on it.

## Open items

None. Phase 0's outcome may force the prebuilt-shim fallback, which is a documented contingency rather than an unresolved question.
