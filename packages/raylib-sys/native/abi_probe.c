#include <raylib.h>
#include <stdint.h>

// Permanent regression guards, not spike leftovers: a raylib version bump can
// change a struct layout with no compile or link error, only wrong values.

static Color color_from_rgba(uint32_t v) {
    Color c;
    c.r = (unsigned char)((v >> 24) & 0xFF);
    c.g = (unsigned char)((v >> 16) & 0xFF);
    c.b = (unsigned char)((v >> 8) & 0xFF);
    c.a = (unsigned char)(v & 0xFF);
    return c;
}

static uint32_t color_to_rgba(Color c) {
    return ((uint32_t)c.r << 24) | ((uint32_t)c.g << 16) |
           ((uint32_t)c.b << 8) | (uint32_t)c.a;
}

uint32_t probe_ret4_GetColor(uint32_t hex) {
    return color_to_rgba(GetColor(hex));
}

int32_t probe_arg4_ColorToInt(uint32_t rgba) {
    return (int32_t)ColorToInt(color_from_rgba(rgba));
}

uint32_t probe_arg4_ret4_Fade(uint32_t rgba, float alpha) {
    return color_to_rgba(Fade(color_from_rgba(rgba), alpha));
}

void probe_ret12_ColorToHSV(uint32_t rgba, float *out) {
    Vector3 v = ColorToHSV(color_from_rgba(rgba));
    out[0] = v.x;
    out[1] = v.y;
    out[2] = v.z;
}

uint32_t probe_ret4_ColorFromHSV(float hue, float saturation, float value) {
    return color_to_rgba(ColorFromHSV(hue, saturation, value));
}

int32_t probe_arg16x2_CheckCollisionRecs(float ax, float ay, float aw, float ah,
                                         float bx, float by, float bw, float bh) {
    Rectangle a = {ax, ay, aw, ah};
    Rectangle b = {bx, by, bw, bh};
    return CheckCollisionRecs(a, b) ? 1 : 0;
}

void probe_arg16x2_ret16_GetCollisionRec(float ax, float ay, float aw, float ah,
                                         float bx, float by, float bw, float bh,
                                         float *out) {
    Rectangle a = {ax, ay, aw, ah};
    Rectangle b = {bx, by, bw, bh};
    Rectangle r = GetCollisionRec(a, b);
    out[0] = r.x;
    out[1] = r.y;
    out[2] = r.width;
    out[3] = r.height;
}

int32_t probe_arg8_arg16_CheckCollisionPointRec(float px, float py,
                                                float rx, float ry,
                                                float rw, float rh) {
    Vector2 p = {px, py};
    Rectangle r = {rx, ry, rw, rh};
    return CheckCollisionPointRec(p, r) ? 1 : 0;
}

void probe_arg8_mem24_GetWorldToScreen2D(float px, float py,
                                         float offsetX, float offsetY,
                                         float targetX, float targetY,
                                         float rotation, float zoom,
                                         float *out) {
    Vector2 p = {px, py};
    Camera2D camera;
    camera.offset = (Vector2){offsetX, offsetY};
    camera.target = (Vector2){targetX, targetY};
    camera.rotation = rotation;
    camera.zoom = zoom;

    Vector2 screen = GetWorldToScreen2D(p, camera);
    out[0] = screen.x;
    out[1] = screen.y;
}

void probe_mem44_sret64_GetCameraMatrix(float posX, float posY, float posZ,
                                        float targetX, float targetY, float targetZ,
                                        float upX, float upY, float upZ,
                                        float fovy, int32_t projection,
                                        float *out16) {
    Camera3D camera;
    camera.position = (Vector3){posX, posY, posZ};
    camera.target = (Vector3){targetX, targetY, targetZ};
    camera.up = (Vector3){upX, upY, upZ};
    camera.fovy = fovy;
    camera.projection = projection;

    Matrix m = GetCameraMatrix(camera);

    out16[0]  = m.m0;  out16[1]  = m.m1;  out16[2]  = m.m2;  out16[3]  = m.m3;
    out16[4]  = m.m4;  out16[5]  = m.m5;  out16[6]  = m.m6;  out16[7]  = m.m7;
    out16[8]  = m.m8;  out16[9]  = m.m9;  out16[10] = m.m10; out16[11] = m.m11;
    out16[12] = m.m12; out16[13] = m.m13; out16[14] = m.m14; out16[15] = m.m15;
}

const char *probe_raylib_version(void) {
    return RAYLIB_VERSION;
}
