# kreb raylib binding layer — design

**Date:** 2026-08-14
**Status:** Phases 0-4 complete and passing. The runtime-compilation approach was tested and rejected in phase 0; this document reflects the prebuilt-shim design that replaced it.
**Scope:** Layer 0 of kreb — the FFI binding between Bun and raylib. The kreb game framework is designed separately in `2026-08-14-kreb-framework-design.md`.

## Purpose

kreb is a game framework for Bun built on raylib. This document specifies the layer underneath it: a Bun FFI binding that exposes raylib to TypeScript.

This layer is **internal**. It is never published as a public package and has no public entrypoint. kreb ships no escape hatch to raw raylib, so nothing outside the framework imports this layer. Its only consumer is `packages/kreb`.

That constraint sets the coverage requirement. Because users cannot reach past the framework, any raylib capability a real game needs must eventually be bound here and surfaced as framework API. Coverage is driven by framework need, not by completeness for its own sake.

## The core problem

raylib passes structs by value throughout its API — `Vector2`, `Vector3`, `Color`, `Rectangle`, `Camera2D`, `Camera3D`. Bun's `dlopen` supports only scalars and pointers. It cannot pass or return a struct by value, which rules out a direct `dlopen` binding for a large fraction of raylib.

The solution is a C shim layer that flattens every struct into scalars or pointers at the JavaScript boundary. The shim is compiled ahead of time by a real C compiler and loaded with `dlopen`. Compiling it at runtime with `cc` from `bun:ffi` was the original plan and was rejected in phase 0 — see the phase 0 outcome section below.

## Architecture

```
vendor/raylib-api/*.json      pinned raylib 6.0 API description, committed
        │  codegen runs at development time; output is committed
        ▼
native/kreb_shim.c            flat C wrappers — no struct-by-value at the JS boundary
generated/*.ts                FFI symbol tables, typed wrappers, enums, constants
        │  compiled per platform in CI by the system C compiler
        ▼
build/<platform>-<arch>/libkreb_raylib.so    shipped prebuilt
        │  dlopen at import time; links against
        ▼
~/.cache/kreb/raylib-6.0-<platform>-<arch>/{include,lib}   fetched by postinstall
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

## Phase 0 outcome: TinyCC rejected

The original design compiled the shim at import time with `cc` from `bun:ffi`, which uses TinyCC. Phase 0 tested that assumption before any other work, and it failed.

Measured on Bun 1.3.14, GCC 16.2.1, raylib 6.0, linux x64. Ten probes covering every SysV AMD64 struct class were compiled both ways and diffed. GCC produced correct results throughout; TinyCC disagreed on eight of ten:

| Probe | Struct class | TinyCC | GCC |
| --- | --- | --- | --- |
| `GetColor` | 4-byte return, alone | agrees | agrees |
| `ColorToInt` | 4-byte arg, alone | agrees | agrees |
| `Fade` | 4-byte in and out plus float | `0x1fe0007f` | `0xff00007f` |
| `ColorFromHSV` | floats in, 4-byte out | `0x000000ff` | `0xff0000ff` |
| `ColorToHSV` | 12-byte SSE return | `[111.7, 1, 0.88]` | `[0, 1, 1]` |
| `CheckCollisionRecs` | two 16-byte SSE args | `0` | `1` |
| `GetCollisionRec` | 16-byte SSE return | `[0, 0, 0, 0]` | `[5, 5, 5, 5]` |
| `CheckCollisionPointRec` | 8-byte and 16-byte SSE | `0` | `1` |
| `GetWorldToScreen2D` | 24-byte MEMORY arg | `[NaN, NaN]` | `[120, 90]` |
| `GetCameraMatrix` | 44-byte MEMORY in, 64-byte sret | all `NaN` | correct |

The result was reproduced with raylib removed entirely, calling a hand-written GCC shared library, which rules out a `raylib.h` parsing fault. In that isolated form TinyCC handled a 4-byte integer-class struct argument correctly and failed a 4-byte struct return, a 12-byte float struct return, two 16-byte float struct arguments, and an 8-byte float struct passed in and returned.

The pattern: **TinyCC handles integer-class struct arguments and nothing else.** Structs containing floats are wrong in both directions, and struct returns are wrong generally. `Vector2`, `Vector3`, and `Rectangle` are the most-used types in raylib's API, so runtime compilation is unusable — and this was x86_64, TinyCC's best-supported target, so aarch64 and Windows could only be worse.

The documented contingency was taken. The same probe C compiled by the system compiler and loaded via `dlopen` passes all eleven assertions, so the fallback was verified in the same session rather than assumed. The codegen and TypeScript layers were unaffected, exactly as the risk analysis predicted.

These probes are retained permanently as `test/nogl/abi.test.ts`, now run against the prebuilt path. A raylib version bump can change a struct layout silently and nothing else in the suite would catch it.

## Build and distribution

`scripts/build-shim.ts` compiles `native/*.c` into a single shared library per platform, linking raylib with an rpath pointing at the cache directory so the loader resolves `libraylib` without the caller setting `LD_LIBRARY_PATH` before process start. It skips the compile when the output is newer than every input.

CI runs this once per platform and architecture. The resulting binaries ship as `optionalDependencies` — one package per target, the pattern esbuild and sharp use — so users need no toolchain. Locally the script runs on demand for development and tests, which does require a system compiler; that requirement applies to contributors only, never to users.

Targets: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`, `win32-arm64`.

## raylib acquisition

A postinstall script downloads the official raylib release archive for the current platform and architecture, verifies it against a pinned SHA-256, and unpacks `include/` and `lib/` into `~/.cache/kreb/raylib-<version>-<platform>-<arch>/`. The version is pinned in `src/raylib-path.ts` alongside the vendored API JSON.

raylib 6.0 is the pinned version. Its release assets were checked during phase 0 and cover every target: `linux_amd64`, `linux_arm64`, `macos` (universal), `win64_msvc16`, `win32_msvc16`, and `winarm64_msvc16`. The `linux_arm64` question raised in the original design is resolved — the asset exists, so no platform needs a source build.

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
- **raymath.** It is header-only inline C. It is reimplemented in pure TypeScript in `packages/kreb-math`, which avoids an FFI crossing per call and is strictly faster than binding it. `native/raymath_probe.c` exposes the C originals to that package's parity tests and is test-only.

## Package layout

```
packages/raylib-sys/
  vendor/raylib-api/raylib_api.json
  tools/codegen/
    load-api.ts        parse and validate the API description
    typemap.ts         the ABI table above — single source of truth
    emit-c.ts          emits native/kreb_shim.c
    emit-ts.ts         emits generated/*.ts
    __snapshots__/     golden output
  generated/           GENERATED, committed
    raylib.ts  enums.ts  colors.ts
  native/
    kreb_shim.c        GENERATED, committed
    abi_probe.c        hand-written, phase 0, retained as regression tests
  build/<platform>-<arch>/libkreb_raylib.<so|dylib|dll>   built by CI, shipped
  src/
    raylib-path.ts     pinned version, cache location
    loader.ts          locate the prebuilt shim, dlopen, cache the handle
    handles.ts         handle base class, dispose, use-after-free guard
    scratch.ts         shared struct-return buffer
  scripts/
    build-shim.ts      compile native/*.c with the system compiler
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
| 0 | **Done.** ABI spike, platform asset check, TinyCC rejected, prebuilt path verified | struct round-trips correct on the prebuilt path; 11 of 11 probes pass on linux-x64 |
| 1 | **Done.** `postinstall.ts`, `loader.ts`, six-target CI matrix | clean install downloads and checksum-verifies raylib; loader dlopens the prebuilt shim |
| 2 | **Done, then removed as superseded.** Hand-written 18-function shim | window opened and drew; deleted once phase 3 passed the same assertions |
| 3 | **Done.** Codegen over all of `raylib.h` | 598 of 600 functions generated, 624 exported symbols, zero compiler warnings; only the two variadic functions skipped |
| 4 | **Done.** Resource handles | 10 handle classes; use-after-dispose throws naming the resource, failed loads throw, ownership transfer via `disown()` |

Phase 2 exists separately from phase 3 deliberately. It is cheap, and it means that when generated code first fails, the loader, the download, and the ABI are already known good, so the bug is in the emitter.

`RenderTexture2D` must be bound during phase 3 — the framework's golden-image tests depend on it.

## Open items

Phase 0 is resolved and the design updated accordingly. Two items move into phase 1:

- **CI build matrix.** Six targets need runners or cross-compilation. `darwin-arm64` and `win32-arm64` in particular need confirmed runner availability.
- **`optionalDependencies` packaging.** Per-platform packages need names, a publish flow, and a resolution failure message that tells the user which platform was unsupported rather than surfacing a bare module-not-found.

The struct-ABI probes were only run on linux-x64. They must run on every target in CI before v1 — a prebuilt shim removes the TinyCC fault but does not by itself prove raylib's struct layout matches expectations on aarch64 or Windows.
