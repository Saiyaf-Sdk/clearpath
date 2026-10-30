import { useEffect, useRef } from 'react';

/*
  Topographic background for the signed-in pages
  -----------------------------------------------
  Contour lines of an imaginary landscape that slowly reshapes itself, like a map of
  shifting terrain. Every fifth line is an "index contour" and is drawn a little bolder,
  as on a real survey map.

  It never reacts to the mouse. It draws about 20 frames a second, stops while the tab is
  hidden, and shows a still map for people who prefer reduced motion.
*/

/* ---------- 3D simplex noise (Stefan Gustavson's public-domain algorithm) ---------- */
const GRAD = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

function makeNoise(seed = 7) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i -= 1) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  return (x, y, z) => {
    const t = (x + y + z) * F3;
    const i = Math.floor(x + t);
    const j = Math.floor(y + t);
    const k = Math.floor(z + t);
    const t0 = (i + j + k) * G3;
    const x0 = x - (i - t0);
    const y0 = y - (j - t0);
    const z0 = z - (k - t0);
    let i1; let j1; let k1; let i2; let j2; let k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    const corners = [
      [x0, y0, z0, 0, 0, 0],
      [x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, i1, j1, k1],
      [x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, i2, j2, k2],
      [x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, 1, 1, 1],
    ];
    let n = 0;
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    for (const [cx, cy, cz, di, dj, dk] of corners) {
      let tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt > 0) {
        const g = GRAD[perm[ii + di + perm[jj + dj + perm[kk + dk]]] % 12];
        tt *= tt;
        n += tt * tt * (g[0] * cx + g[1] * cy + g[2] * cz);
      }
    }
    return 32 * n; // about -1..1
  };
}

/* ---------- look ---------- */
const CELL = 24; // optimized grid size to eliminate CPU lag
const SCALE = 1 / 420; // size of the "hills"
const SPEED = 0.0016; // how fast the terrain reshapes (per frame)
const DRIFT = 0.12; // slow sideways drift of the whole map (px per frame)
const LEVELS = 14; // contour lines between the lowest and highest ground
const FPS = 12; // buttery smooth drift without blocking UI thread

const STYLE = {
  light: { line: 'rgba(79, 70, 229, 0.13)', index: 'rgba(79, 70, 229, 0.24)' },
  dark: { line: 'rgba(165, 180, 252, 0.12)', index: 'rgba(165, 180, 252, 0.23)' },
};

// Marching squares: adds the contour segments for one level to the path
function traceLevel(path, field, cols, rows, level) {
  const w = cols + 1;
  const lerp = (a, b) => (level - a) / (b - a);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const tl = field[y * w + x];
      const tr = field[y * w + x + 1];
      const br = field[(y + 1) * w + x + 1];
      const bl = field[(y + 1) * w + x];
      const c = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const px = x * CELL;
      const py = y * CELL;
      const top = [px + CELL * lerp(tl, tr), py];
      const right = [px + CELL, py + CELL * lerp(tr, br)];
      const bottom = [px + CELL * lerp(bl, br), py + CELL];
      const left = [px, py + CELL * lerp(tl, bl)];
      const seg = (a, b) => { path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]); };
      switch (c) {
        case 1: case 14: seg(left, bottom); break;
        case 2: case 13: seg(bottom, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 6: case 9: seg(top, bottom); break;
        case 7: case 8: seg(left, top); break;
        case 5: case 10: {
          // saddle: decide by the centre value
          const mid = (tl + tr + br + bl) / 4 > level;
          if ((c === 5) === mid) { seg(left, top); seg(bottom, right); } else { seg(left, bottom); seg(top, right); }
          break;
        }
        default: break;
      }
    }
  }
}

export default function TopoBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const noise = makeNoise(11);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let field = new Float32Array(0);
    let z = 0;
    let shift = 0;
    let raf = 0;
    let last = 0;
    let theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      field = new Float32Array((cols + 1) * (rows + 1));
    };

    const draw = () => {
      const w = cols + 1;
      let min = Infinity;
      let max = -Infinity;
      for (let y = 0; y <= rows; y += 1) {
        for (let x = 0; x <= cols; x += 1) {
          const sx = (x * CELL + shift) * SCALE;
          const sy = y * CELL * SCALE;
          // two layers of hills: broad shapes plus finer ridges
          const v = noise(sx, sy, z) + 0.45 * noise(sx * 2.1 + 5.2, sy * 2.1 - 1.7, z * 1.4);
          field[y * w + x] = v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const style = STYLE[theme];
      // Fixed absolute levels so lines move smoothly instead of jumping when the range changes
      const lo = -1.25;
      const step = 2.5 / LEVELS;
      const fine = new Path2D();
      const bold = new Path2D();
      for (let i = 1; i < LEVELS; i += 1) {
        const level = lo + i * step;
        if (level < min || level > max) continue;
        traceLevel(i % 5 === 0 ? bold : fine, field, cols, rows, level);
      }
      ctx.strokeStyle = style.line;
      ctx.lineWidth = 1;
      ctx.stroke(fine);
      ctx.strokeStyle = style.index;
      ctx.lineWidth = 1.4;
      ctx.stroke(bold);
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 1000 / FPS) return;
      last = now;
      z += SPEED;
      shift += DRIFT;
      draw();
    };

    resize();
    draw();
    if (!still) raf = requestAnimationFrame(tick);

    const onResize = () => { resize(); draw(); };
    window.addEventListener('resize', onResize);
    // Follow the light / dark switch
    const watch = new MutationObserver(() => {
      theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      draw();
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      watch.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="topo-bg" aria-hidden="true" />;
}
