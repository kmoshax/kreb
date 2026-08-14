#ifndef KREB_COLOR_H
#define KREB_COLOR_H

#include <raylib.h>
#include <stdint.h>

// Colors cross the JavaScript boundary packed as 0xRRGGBBAA, matching raylib's
// own GetColor and ColorToInt convention.

static inline Color kreb_color_from_rgba(uint32_t v) {
    Color c;
    c.r = (unsigned char)((v >> 24) & 0xFF);
    c.g = (unsigned char)((v >> 16) & 0xFF);
    c.b = (unsigned char)((v >> 8) & 0xFF);
    c.a = (unsigned char)(v & 0xFF);
    return c;
}

static inline uint32_t kreb_color_to_rgba(Color c) {
    return ((uint32_t)c.r << 24) | ((uint32_t)c.g << 16) |
           ((uint32_t)c.b << 8) | (uint32_t)c.a;
}

#endif
