import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MAIN_FRAG, TRAIL_FRAG, VERT } from './liquidShaders';

/*
  "Liquid silk" background
  ------------------------
  A GPU shader paints slowly flowing indigo silk. When the mouse moves it leaves a soft
  liquid trail that drags the silk and slowly settles; around the cursor the silk turns
  more vivid, like a lens. Each page gathers the silk in a different place, so the
  background glides to a new shape whenever you navigate.

  Quality adapts to the device, it pauses when the tab is hidden, stays still for people
  who reduce motion, and falls back to soft CSS glows if WebGL isn't available.
*/

// Where the silk gathers (x, y in 0..1 with y up) and how strong it is, per kind of page
const SCENES = {
  landing: { focus: [0.74, 0.92], intensity: 1.0 },
  auth: { focus: [0.22, 0.62], intensity: 0.9 },
  info: { focus: [0.5, 1.02], intensity: 0.75 },
  app: { focus: [0.88, 1.08], intensity: 0.5 },
};

// Indigo-only palettes: background, then four steps from pale to accent
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PALETTES = {
  light: { bg: hex('#f7f8fb'), c1: hex('#e9ecff'), c2: hex('#c7d2fe'), c3: hex('#818cf8'), c4: hex('#4f46e5'), k: 0.78 },
  dark: { bg: hex('#0a0f1c'), c1: hex('#121838'), c2: hex('#262a78'), c3: hex('#4f46e5'), c4: hex('#a5b4fc'), k: 1 },
};

export const sceneFor = (path) => {
  if (path === '/') return 'landing';
  if (['/login', '/register', '/forgot-password'].includes(path) || path.startsWith('/reset-password')) return 'auth';
  if (path.startsWith('/verify') || path === '/help') return 'info';
  return 'app';
};

/* ---------------- WebGL helpers ---------------- */
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log || 'shader compile failed');
  }
  return sh;
}

function program(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  let fs;
  try {
    fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  } catch (err) {
    gl.deleteShader(vs);
    throw err;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  // Shaders aren't needed once linked – free them
  gl.detachShader(prog, vs);
  gl.detachShader(prog, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(log || 'link failed');
  }
  const uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i += 1) {
    const info = gl.getActiveUniform(prog, i);
    uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, u: uniforms };
}

function makeTarget(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // start "still": velocity 0.5, no ink
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 128; data[i + 1] = 128; data[i + 3] = 255; }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb };
}

const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- the liquid renderer ---------------- */
function useLiquid(canvasRef, sceneRef, kickRef, paused, onFail) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || paused) return undefined;

    const gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance',
    });
    if (!gl) { onFail(); return undefined; }

    let main;
    let trail;
    try {
      main = program(gl, VERT, MAIN_FRAG);
      trail = program(gl, VERT, TRAIL_FRAG);
    } catch (err) {
      if (main) gl.deleteProgram(main.prog);
      console.warn('Liquid background disabled:', err.message);
      onFail();
      return undefined;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let scale = coarse ? 0.4 : 0.55; // the silk is soft, so it renders at reduced resolution
    let targets = [];
    let tw = 0;
    let th = 0;
    let raf = 0;
    let running = true;

    const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    const pal = JSON.parse(JSON.stringify(PALETTES[theme()]));
    const sc = sceneRef.current;
    const state = { focus: [...SCENES[sc].focus], intensity: SCENES[sc].intensity };

    const mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, px: 0.5, py: 0.5, inside: false, hover: 0 };

    const resize = () => {
      const w = Math.max(1, Math.round(window.innerWidth * scale));
      const h = Math.max(1, Math.round(window.innerHeight * scale));
      canvas.width = w;
      canvas.height = h;
      const aspect = window.innerWidth / window.innerHeight;
      const nw = 256;
      const nh = Math.max(32, Math.round(nw / aspect));
      if (nw !== tw || nh !== th) {
        targets.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
        tw = nw;
        th = nh;
        targets = [makeTarget(gl, tw, th), makeTarget(gl, tw, th)];
      }
    };

    const start = performance.now();
    let frames = 0;
    let slowFrames = 0;
    let last = start;

    const render = (now) => {
      if (!running) return;
      const time = (now - start) / 1000;

      // Adaptive quality: drop resolution once if the device is struggling
      const dt = now - last;
      last = now;
      frames += 1;
      if (frames > 30 && frames < 240 && dt > 24) slowFrames += 1;
      if (slowFrames > 40 && scale > 0.36) { scale = 0.36; slowFrames = -9999; resize(); }

      // Ease towards the current page's scene and theme palette
      const target = SCENES[sceneRef.current];
      state.focus[0] = lerp(state.focus[0], target.focus[0], 0.03);
      state.focus[1] = lerp(state.focus[1], target.focus[1], 0.03);
      state.intensity = lerp(state.intensity, target.intensity, 0.03);
      const goal = PALETTES[theme()];
      ['bg', 'c1', 'c2', 'c3', 'c4'].forEach((key) => {
        for (let i = 0; i < 3; i += 1) pal[key][i] = lerp(pal[key][i], goal[key][i], 0.08);
      });
      pal.k = lerp(pal.k, goal.k, 0.08);

      // Smooth cursor for the lens; raw movement for the trail
      mouse.sx = lerp(mouse.sx, mouse.x, 0.12);
      mouse.sy = lerp(mouse.sy, mouse.y, 0.12);
      mouse.hover = lerp(mouse.hover, mouse.inside ? 1 : 0, 0.05);
      const vx = Math.max(-0.05, Math.min(0.05, mouse.x - mouse.px));
      const vy = Math.max(-0.05, Math.min(0.05, mouse.y - mouse.py));
      mouse.px = mouse.x;
      mouse.py = mouse.y;

      // 1) trail pass (ping-pong)
      const [read, write] = targets;
      gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb);
      gl.viewport(0, 0, tw, th);
      gl.useProgram(trail.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, read.tex);
      gl.uniform1i(trail.u.u_prev, 0);
      gl.uniform2f(trail.u.u_mouse, mouse.x, mouse.y);
      gl.uniform2f(trail.u.u_vel, vx, vy);
      gl.uniform1f(trail.u.u_aspect, window.innerWidth / window.innerHeight);
      gl.uniform1f(trail.u.u_active, mouse.inside ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      targets = [write, read];

      // 2) silk pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(main.prog);
      gl.bindTexture(gl.TEXTURE_2D, write.tex);
      gl.uniform1i(main.u.u_trail, 0);
      gl.uniform2f(main.u.u_res, canvas.width, canvas.height);
      gl.uniform1f(main.u.u_time, reduce ? 12 : time);
      gl.uniform2f(main.u.u_mouse, mouse.sx, mouse.sy);
      gl.uniform1f(main.u.u_hover, mouse.hover);
      gl.uniform2f(main.u.u_focus, state.focus[0], state.focus[1]);
      gl.uniform1f(main.u.u_intensity, state.intensity * pal.k);
      gl.uniform3fv(main.u.u_bg, pal.bg);
      gl.uniform3fv(main.u.u_c1, pal.c1);
      gl.uniform3fv(main.u.u_c2, pal.c2);
      gl.uniform3fv(main.u.u_c3, pal.c3);
      gl.uniform3fv(main.u.u_c4, pal.c4);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      raf = requestAnimationFrame(render);
    };

    // Reduced motion: no continuous loop – just re-render a still frame when something changes
    const renderStill = () => {
      cancelAnimationFrame(raf);
      let n = 0;
      const step = (now) => { render(now); cancelAnimationFrame(raf); n += 1; if (n < 90) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (reduce) renderStill();
      else { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }
    };

    const onMove = (e) => {
      if (e.pointerType !== 'mouse' || reduce) return;
      const x = e.clientX / window.innerWidth;
      const y = 1 - e.clientY / window.innerHeight;
      if (!mouse.inside) { mouse.px = x; mouse.py = y; mouse.sx = x; mouse.sy = y; }
      mouse.x = x;
      mouse.y = y;
      mouse.inside = true;
    };
    const onLeave = () => { mouse.inside = false; };
    const onResize = () => { resize(); if (reduce) renderStill(); };
    const onVisible = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); } else { running = true; kick(); }
    };
    const onLost = (e) => { e.preventDefault(); running = false; cancelAnimationFrame(raf); onFail(); };
    const themeWatch = new MutationObserver(() => { if (reduce) renderStill(); });

    resize();
    kick();
    kickRef.current = kick;
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisible);
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      running = false;
      kickRef.current = null;
      cancelAnimationFrame(raf);
      themeWatch.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost);
      targets.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
      gl.deleteBuffer(quad);
      gl.deleteProgram(main.prog);
      gl.deleteProgram(trail.prog);
    };
  }, [canvasRef, sceneRef, kickRef, paused, onFail]);
}

/* ---------------- CSS fallback (no WebGL) ---------------- */
const FALLBACK = {
  landing: [{ x: -8, y: -14, s: 1.1 }, { x: 58, y: 4, s: 0.95 }, { x: 22, y: 62, s: 0.8 }],
  auth: [{ x: -14, y: 30, s: 1.15 }, { x: 62, y: -16, s: 0.9 }, { x: 40, y: 66, s: 0.75 }],
  info: [{ x: 50, y: -20, s: 1 }, { x: -18, y: 22, s: 0.85 }, { x: 70, y: 60, s: 0.7 }],
  app: [{ x: 64, y: -22, s: 0.95 }, { x: -20, y: -10, s: 0.8 }, { x: 30, y: 74, s: 0.65 }],
};

export default function AnimatedBackground({ path, paused = false }) {
  const scene = sceneFor(path);
  const canvasRef = useRef(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene; // read every frame, so page changes glide without restarting WebGL
  const [failed, setFailed] = useState(false);
  const onFail = useRef(() => setFailed(true)).current;

  const kickRef = useRef(null);
  useLiquid(canvasRef, sceneRef, kickRef, paused || failed, onFail);

  // With reduced motion there is no running loop, so redraw once when the page changes
  useEffect(() => {
    kickRef.current?.();
  }, [scene]);

  return (
    <div className={`live-bg scene-${scene}`} aria-hidden="true">
      {failed ? (
        <div className="aurora">
          {FALLBACK[scene].map((b, i) => (
            <motion.div
              key={i}
              className={`aurora-blob b${i + 1}`}
              initial={false}
              animate={{ x: `${b.x}vw`, y: `${b.y}vh`, scale: b.s }}
              transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <span />
            </motion.div>
          ))}
        </div>
      ) : (
        <canvas ref={canvasRef} className="liquid-canvas" />
      )}
      <div className="bg-grain" />
    </div>
  );
}
