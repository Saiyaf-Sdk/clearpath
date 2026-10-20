// GLSL shaders for the liquid silk background (WebGL 1).

export const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Trail pass: a small texture that remembers where the cursor has been.
// r,g = velocity (0.5 = still), b = ink amount. It slowly advects and fades every frame.
export const TRAIL_FRAG = `
precision mediump float;
uniform sampler2D u_prev;
uniform vec2 u_mouse;     // 0..1, y up
uniform vec2 u_vel;       // cursor velocity in uv per frame
uniform float u_aspect;
uniform float u_active;   // 1 while the mouse is over the page
varying vec2 v_uv;

const vec2 MID = vec2(128.0 / 255.0); // "still" value, stored exactly in an 8-bit texture

void main() {
  vec2 v0 = texture2D(u_prev, v_uv).rg - MID;
  // Carry the trail along its own motion so it flows like liquid
  vec4 p = texture2D(u_prev, v_uv - v0 * 0.012);
  vec2 vel = (p.rg - MID) * 0.962;
  // always drop at least one 8-bit step, so rounding can never freeze the trail
  vel -= sign(vel) * min(abs(vel), vec2(0.6 / 255.0));
  float ink = max(p.b * 0.988 - 0.003, 0.0);

  vec2 d = v_uv - u_mouse;
  d.x *= u_aspect;
  float splat = exp(-dot(d, d) / 0.0011) * u_active;
  float speed = clamp(length(u_vel) * 40.0, 0.0, 1.0);

  ink = min(1.0, ink + splat * (0.012 + 0.16 * speed));
  vel += u_vel * splat * 3.0;
  vel = clamp(vel, vec2(-0.49), vec2(0.49));

  gl_FragColor = vec4(vel + MID, ink, 1.0);
}
`;

// Main pass: domain-warped noise ("silk"), dragged by the trail and lit by the cursor.
export const MAIN_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;      // smoothed cursor, 0..1, y up
uniform float u_hover;     // 0..1 fades the lens in/out
uniform sampler2D u_trail;
uniform vec2 u_focus;      // where the silk gathers on this page
uniform float u_intensity; // how much silk is shown on this page
uniform vec3 u_bg;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
varying vec2 v_uv;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash(i), f), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  vec4 tr = texture2D(u_trail, uv);
  vec2 flow = tr.rg - 128.0 / 255.0;
  float ink = 1.0 - exp(-tr.b * 6.0); // soft saturation: long faint tail, never a solid blob

  // The cursor trail drags the silk like a hand through liquid
  p -= flow * 0.7;

  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  float md = length(p - m);
  float lens = smoothstep(0.42, 0.0, md) * u_hover;
  // a gentle swirl around the cursor
  float ang = lens * 0.9;
  vec2 rel = p - m;
  p = m + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rel;

  float t = u_time * 0.045;
  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, t)), fbm(p * 1.1 + vec2(5.2, -t)));
  vec2 r = vec2(
    fbm(p * 1.25 + 3.0 * q + vec2(1.7, 9.2) + t * 1.4),
    fbm(p * 1.25 + 3.0 * q + vec2(8.3, 2.8) - t * 1.1)
  );
  float f = fbm(p * 1.0 + 3.1 * r) * 0.5 + 0.5;

  // Colour: pale -> soft indigo -> indigo -> deep/bright accent
  vec3 col = mix(u_c1, u_c2, smoothstep(0.30, 0.62, f));
  col = mix(col, u_c3, smoothstep(0.48, 0.80, f + 0.22 * length(r)));
  col = mix(col, u_c4, smoothstep(0.66, 0.98, f + 0.12 * ink + 0.2 * lens));
  // the trail always reads as a soft ribbon, so it stays connected to the pointer
  col = mix(col, mix(u_c3, u_c4, 0.5), ink * 0.26);

  // Soft silk folds – thin highlights that catch the "light"
  float folds = pow(1.0 - abs(sin((f * 4.0 + r.y * 1.4) * 3.14159)), 9.0);

  // Where the silk is visible: the page's focus area, around the cursor, and along the trail
  vec2 fd = (uv - u_focus) * vec2(aspect * 0.62, 1.0);
  float area = smoothstep(1.05, 0.05, length(fd));
  float amount = u_intensity * (area * 0.80 + lens * 0.45 + ink * 0.9);
  amount *= 0.55 + 0.55 * smoothstep(0.25, 0.75, f);
  amount = clamp(amount, 0.0, 0.82);

  vec3 outc = mix(u_bg, col, amount);
  outc = mix(outc, u_c4, folds * (0.04 + lens * 0.12 + ink * 0.18) * u_intensity);

  gl_FragColor = vec4(outc, 1.0);
}
`;
