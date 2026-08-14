#ifndef KREB_MATRIX_H
#define KREB_MATRIX_H

#include <raylib.h>

// raylib declares Matrix fields as m0, m4, m8, m12, m1, ... so raw memory order
// is not m-index order. These map to m0..m15, matching MatrixToFloatV.

static inline Matrix kreb_matrix_from_floats(const float *v) {
    Matrix out = { v[0], v[4], v[8],  v[12],
                   v[1], v[5], v[9],  v[13],
                   v[2], v[6], v[10], v[14],
                   v[3], v[7], v[11], v[15] };
    return out;
}

static inline void kreb_matrix_to_floats(Matrix m, float *v) {
    v[0] = m.m0;   v[1] = m.m1;   v[2] = m.m2;   v[3] = m.m3;
    v[4] = m.m4;   v[5] = m.m5;   v[6] = m.m6;   v[7] = m.m7;
    v[8] = m.m8;   v[9] = m.m9;   v[10] = m.m10; v[11] = m.m11;
    v[12] = m.m12; v[13] = m.m13; v[14] = m.m14; v[15] = m.m15;
}

#endif
