// Reference implementations for the pure-TypeScript raymath port to be checked
// against. raymath.h is header-only inline C, so it cannot be reached through
// the normal binding; these wrappers give the parity tests something to call.

#include "kreb_matrix.h"
#include <raylib.h>
#include <raymath.h>
#include <stdint.h>

float rm_Clamp(float value, float min, float max) { return Clamp(value, min, max); }
float rm_Lerp(float start, float end, float amount) { return Lerp(start, end, amount); }
float rm_Normalize(float value, float start, float end) { return Normalize(value, start, end); }
float rm_Wrap(float value, float min, float max) { return Wrap(value, min, max); }

float rm_Remap(float value, float inputStart, float inputEnd, float outputStart, float outputEnd) {
    return Remap(value, inputStart, inputEnd, outputStart, outputEnd);
}

int32_t rm_FloatEquals(float x, float y) { return FloatEquals(x, y); }

float rm_Vector2Angle(float x1, float y1, float x2, float y2) {
    return Vector2Angle((Vector2){x1, y1}, (Vector2){x2, y2});
}

float rm_Vector2LineAngle(float x1, float y1, float x2, float y2) {
    return Vector2LineAngle((Vector2){x1, y1}, (Vector2){x2, y2});
}

static void write2(Vector2 v, float *out) { out[0] = v.x; out[1] = v.y; }
static void write3(Vector3 v, float *out) { out[0] = v.x; out[1] = v.y; out[2] = v.z; }
static void write4(Vector4 v, float *out) { out[0] = v.x; out[1] = v.y; out[2] = v.z; out[3] = v.w; }

void rm_Vector2Rotate(float x, float y, float angle, float *out) {
    write2(Vector2Rotate((Vector2){x, y}, angle), out);
}

void rm_Vector2Refract(float vx, float vy, float nx, float ny, float r, float *out) {
    write2(Vector2Refract((Vector2){vx, vy}, (Vector2){nx, ny}, r), out);
}

void rm_Vector2MoveTowards(float x, float y, float tx, float ty, float maxDistance, float *out) {
    write2(Vector2MoveTowards((Vector2){x, y}, (Vector2){tx, ty}, maxDistance), out);
}

void rm_Vector2ClampValue(float x, float y, float min, float max, float *out) {
    write2(Vector2ClampValue((Vector2){x, y}, min, max), out);
}

void rm_Vector2Reflect(float x, float y, float nx, float ny, float *out) {
    write2(Vector2Reflect((Vector2){x, y}, (Vector2){nx, ny}), out);
}

void rm_Vector2Transform(float x, float y, const float *mat, float *out) {
    write2(Vector2Transform((Vector2){x, y}, kreb_matrix_from_floats(mat)), out);
}

void rm_Vector3Perpendicular(float x, float y, float z, float *out) {
    write3(Vector3Perpendicular((Vector3){x, y, z}), out);
}

float rm_Vector3Angle(float ax, float ay, float az, float bx, float by, float bz) {
    return Vector3Angle((Vector3){ax, ay, az}, (Vector3){bx, by, bz});
}

void rm_Vector3RotateByAxisAngle(float x, float y, float z, float ax, float ay, float az,
                                 float angle, float *out) {
    write3(Vector3RotateByAxisAngle((Vector3){x, y, z}, (Vector3){ax, ay, az}, angle), out);
}

void rm_Vector3RotateByQuaternion(float x, float y, float z, float qx, float qy, float qz,
                                  float qw, float *out) {
    write3(Vector3RotateByQuaternion((Vector3){x, y, z}, (Quaternion){qx, qy, qz, qw}), out);
}

void rm_Vector3Barycenter(float px, float py, float pz, float ax, float ay, float az,
                          float bx, float by, float bz, float cx, float cy, float cz, float *out) {
    write3(Vector3Barycenter((Vector3){px, py, pz}, (Vector3){ax, ay, az},
                             (Vector3){bx, by, bz}, (Vector3){cx, cy, cz}), out);
}

void rm_Vector3Refract(float x, float y, float z, float nx, float ny, float nz, float r, float *out) {
    write3(Vector3Refract((Vector3){x, y, z}, (Vector3){nx, ny, nz}, r), out);
}

void rm_Vector3OrthoNormalize(float ax, float ay, float az, float bx, float by, float bz, float *out) {
    Vector3 v1 = {ax, ay, az};
    Vector3 v2 = {bx, by, bz};
    Vector3OrthoNormalize(&v1, &v2);
    write3(v1, out);
    write3(v2, out + 3);
}

void rm_Vector3Project(float ax, float ay, float az, float bx, float by, float bz, float *out) {
    write3(Vector3Project((Vector3){ax, ay, az}, (Vector3){bx, by, bz}), out);
}

void rm_Vector3Reject(float ax, float ay, float az, float bx, float by, float bz, float *out) {
    write3(Vector3Reject((Vector3){ax, ay, az}, (Vector3){bx, by, bz}), out);
}

void rm_Vector3CubicHermite(float ax, float ay, float az, float t1x, float t1y, float t1z,
                            float bx, float by, float bz, float t2x, float t2y, float t2z,
                            float amount, float *out) {
    write3(Vector3CubicHermite((Vector3){ax, ay, az}, (Vector3){t1x, t1y, t1z},
                               (Vector3){bx, by, bz}, (Vector3){t2x, t2y, t2z}, amount), out);
}

void rm_Vector3Transform(float x, float y, float z, const float *mat, float *out) {
    write3(Vector3Transform((Vector3){x, y, z}, kreb_matrix_from_floats(mat)), out);
}

void rm_Vector3Unproject(float x, float y, float z, const float *projection, const float *view,
                         float *out) {
    write3(Vector3Unproject((Vector3){x, y, z}, kreb_matrix_from_floats(projection),
                            kreb_matrix_from_floats(view)), out);
}

void rm_Vector3ClampValue(float x, float y, float z, float min, float max, float *out) {
    write3(Vector3ClampValue((Vector3){x, y, z}, min, max), out);
}

void rm_Vector3MoveTowards(float x, float y, float z, float tx, float ty, float tz,
                           float maxDistance, float *out) {
    write3(Vector3MoveTowards((Vector3){x, y, z}, (Vector3){tx, ty, tz}, maxDistance), out);
}

float rm_MatrixDeterminant(const float *mat) {
    return MatrixDeterminant(kreb_matrix_from_floats(mat));
}

float rm_MatrixTrace(const float *mat) { return MatrixTrace(kreb_matrix_from_floats(mat)); }

void rm_MatrixTranspose(const float *mat, float *out) {
    kreb_matrix_to_floats(MatrixTranspose(kreb_matrix_from_floats(mat)), out);
}

void rm_MatrixInvert(const float *mat, float *out) {
    kreb_matrix_to_floats(MatrixInvert(kreb_matrix_from_floats(mat)), out);
}

void rm_MatrixMultiply(const float *left, const float *right, float *out) {
    kreb_matrix_to_floats(
        MatrixMultiply(kreb_matrix_from_floats(left), kreb_matrix_from_floats(right)), out);
}

void rm_MatrixTranslate(float x, float y, float z, float *out) {
    kreb_matrix_to_floats(MatrixTranslate(x, y, z), out);
}

void rm_MatrixScale(float x, float y, float z, float *out) {
    kreb_matrix_to_floats(MatrixScale(x, y, z), out);
}

void rm_MatrixRotate(float x, float y, float z, float angle, float *out) {
    kreb_matrix_to_floats(MatrixRotate((Vector3){x, y, z}, angle), out);
}

void rm_MatrixRotateX(float angle, float *out) { kreb_matrix_to_floats(MatrixRotateX(angle), out); }
void rm_MatrixRotateY(float angle, float *out) { kreb_matrix_to_floats(MatrixRotateY(angle), out); }
void rm_MatrixRotateZ(float angle, float *out) { kreb_matrix_to_floats(MatrixRotateZ(angle), out); }

void rm_MatrixRotateXYZ(float x, float y, float z, float *out) {
    kreb_matrix_to_floats(MatrixRotateXYZ((Vector3){x, y, z}), out);
}

void rm_MatrixRotateZYX(float x, float y, float z, float *out) {
    kreb_matrix_to_floats(MatrixRotateZYX((Vector3){x, y, z}), out);
}

void rm_MatrixFrustum(double left, double right, double bottom, double top,
                      double nearPlane, double farPlane, float *out) {
    kreb_matrix_to_floats(MatrixFrustum(left, right, bottom, top, nearPlane, farPlane), out);
}

void rm_MatrixPerspective(double fovY, double aspect, double nearPlane, double farPlane, float *out) {
    kreb_matrix_to_floats(MatrixPerspective(fovY, aspect, nearPlane, farPlane), out);
}

void rm_MatrixOrtho(double left, double right, double bottom, double top,
                    double nearPlane, double farPlane, float *out) {
    kreb_matrix_to_floats(MatrixOrtho(left, right, bottom, top, nearPlane, farPlane), out);
}

void rm_MatrixLookAt(float ex, float ey, float ez, float tx, float ty, float tz,
                     float ux, float uy, float uz, float *out) {
    kreb_matrix_to_floats(
        MatrixLookAt((Vector3){ex, ey, ez}, (Vector3){tx, ty, tz}, (Vector3){ux, uy, uz}), out);
}

void rm_MatrixCompose(float tx, float ty, float tz, float qx, float qy, float qz, float qw,
                      float sx, float sy, float sz, float *out) {
    kreb_matrix_to_floats(
        MatrixCompose((Vector3){tx, ty, tz}, (Quaternion){qx, qy, qz, qw}, (Vector3){sx, sy, sz}),
        out);
}

// Layout: translation (3), rotation (4), scale (3).
void rm_MatrixDecompose(const float *mat, float *out) {
    Vector3 translation = {0};
    Quaternion rotation = {0};
    Vector3 scale = {0};

    MatrixDecompose(kreb_matrix_from_floats(mat), &translation, &rotation, &scale);

    write3(translation, out);
    write4(rotation, out + 3);
    write3(scale, out + 7);
}

void rm_QuaternionMultiply(float ax, float ay, float az, float aw,
                           float bx, float by, float bz, float bw, float *out) {
    write4(QuaternionMultiply((Quaternion){ax, ay, az, aw}, (Quaternion){bx, by, bz, bw}), out);
}

void rm_QuaternionInvert(float x, float y, float z, float w, float *out) {
    write4(QuaternionInvert((Quaternion){x, y, z, w}), out);
}

void rm_QuaternionNlerp(float ax, float ay, float az, float aw,
                        float bx, float by, float bz, float bw, float amount, float *out) {
    write4(QuaternionNlerp((Quaternion){ax, ay, az, aw}, (Quaternion){bx, by, bz, bw}, amount), out);
}

void rm_QuaternionSlerp(float ax, float ay, float az, float aw,
                        float bx, float by, float bz, float bw, float amount, float *out) {
    write4(QuaternionSlerp((Quaternion){ax, ay, az, aw}, (Quaternion){bx, by, bz, bw}, amount), out);
}

void rm_QuaternionCubicHermiteSpline(float ax, float ay, float az, float aw,
                                     float t1x, float t1y, float t1z, float t1w,
                                     float bx, float by, float bz, float bw,
                                     float t2x, float t2y, float t2z, float t2w,
                                     float t, float *out) {
    write4(QuaternionCubicHermiteSpline((Quaternion){ax, ay, az, aw}, (Quaternion){t1x, t1y, t1z, t1w},
                                        (Quaternion){bx, by, bz, bw}, (Quaternion){t2x, t2y, t2z, t2w},
                                        t), out);
}

void rm_QuaternionFromVector3ToVector3(float ax, float ay, float az,
                                       float bx, float by, float bz, float *out) {
    write4(QuaternionFromVector3ToVector3((Vector3){ax, ay, az}, (Vector3){bx, by, bz}), out);
}

void rm_QuaternionFromMatrix(const float *mat, float *out) {
    write4(QuaternionFromMatrix(kreb_matrix_from_floats(mat)), out);
}

void rm_QuaternionToMatrix(float x, float y, float z, float w, float *out) {
    kreb_matrix_to_floats(QuaternionToMatrix((Quaternion){x, y, z, w}), out);
}

void rm_QuaternionFromAxisAngle(float ax, float ay, float az, float angle, float *out) {
    write4(QuaternionFromAxisAngle((Vector3){ax, ay, az}, angle), out);
}

// Layout: axis (3), angle (1).
void rm_QuaternionToAxisAngle(float x, float y, float z, float w, float *out) {
    Vector3 axis = {0};
    float angle = 0.0f;

    QuaternionToAxisAngle((Quaternion){x, y, z, w}, &axis, &angle);

    write3(axis, out);
    out[3] = angle;
}

void rm_QuaternionFromEuler(float pitch, float yaw, float roll, float *out) {
    write4(QuaternionFromEuler(pitch, yaw, roll), out);
}

void rm_QuaternionToEuler(float x, float y, float z, float w, float *out) {
    write3(QuaternionToEuler((Quaternion){x, y, z, w}), out);
}

void rm_QuaternionTransform(float x, float y, float z, float w, const float *mat, float *out) {
    write4(QuaternionTransform((Quaternion){x, y, z, w}, kreb_matrix_from_floats(mat)), out);
}
