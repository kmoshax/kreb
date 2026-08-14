# @kreb/math

raylib's `raymath.h` ported to TypeScript. All 146 functions: `Vector2`, `Vector3`, `Vector4`/`Quaternion`, `Matrix`, and the scalar helpers.

No native dependency — no shim, no raylib download, no GPU. It runs anywhere Bun does and is usable on its own.

```ts
import { MatrixLookAt, QuaternionFromEuler, Vector3Normalize } from '@kreb/math'

const view = MatrixLookAt({ x: 4, y: 3, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
```

Vectors are plain objects (`{ x, y }`). A `Matrix` is a `Float32Array` of 16 floats.

## The Matrix index trap

raylib declares its `Matrix` fields as `m0, m4, m8, m12, m1, ...` — row by row. Raw struct memory order is therefore **not** m-index order.

`Matrix[k]` here holds raylib's field `mK`, matching `MatrixToFloatV` and what a shader expects. Building a matrix by transcribing a C brace-initializer transposes it. That mistake produced three separate bugs during the port, which is why the parity suite exists: every function is checked against raylib's own inline C through a probe shim.

```bash
bun test packages/kreb-math
```
