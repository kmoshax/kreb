# @kreb/raylib-sys

The raylib FFI layer for kreb. **Internal** — no public entrypoint, no stability promise. Use `kreb`.

## How it works

raylib passes structs by value throughout its API, and Bun's `dlopen` supports only scalars and pointers. A generated C shim flattens every struct at the JavaScript boundary: `Vector2` becomes two floats, `Color` becomes a packed `uint32_t`, resource structs become heap pointers behind opaque handles.

`tools/codegen/typemap.ts` is the single source of ABI truth — the C emitter and the TypeScript emitter both read it, so the two sides cannot drift. 598 of raylib's 600 functions are generated; the two skipped are variadic and named in the codegen output rather than silently dropped.

## Why the shim is prebuilt

The original design compiled the shim at import time with `cc` from `bun:ffi`, which uses TinyCC. That was tested first and failed: TinyCC's struct-by-value ABI does not match GCC's on x86_64. It handles integer-class struct arguments and nothing else — struct returns are wrong generally, and any struct containing floats is wrong in both directions, which covers `Vector2`, `Vector3`, and `Rectangle`.

Reproduced with raylib removed entirely against a hand-written GCC library, so it is not a header-parsing fault. The evidence table is in the binding layer design document.

The shim is therefore compiled ahead of time by a real C compiler and loaded with `dlopen`. The probes survive as `test/nogl/abi.test.ts`, because a raylib version bump can change a struct layout with no compile or link error — only wrong values.

## Commands

```bash
bun run --filter @kreb/raylib-sys vendor:api     # fetch and repair raylib_api.json
bun run --filter @kreb/raylib-sys codegen        # regenerate shim + bindings
bun run --filter @kreb/raylib-sys build:shim     # compile for this platform
```

`vendor:api` includes a repair step: raylib's own parser emits a description containing an unescaped quote, producing invalid JSON. The same defect is in its XML and Lua output, so switching formats does not avoid it.
