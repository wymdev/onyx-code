// One-off generator for public/icon.png (the Electron/Windows app icon).
// Pure Node (fs + zlib only, no new deps) - rasterizes the same sphere+ring
// mark used by src/components/OnyxCodeLogo.tsx onto a rounded-square
// badge background, so the packaged app has a real, on-brand icon instead
// of silently falling back to Electron's default.
//
// Re-run with: node scripts/generate-icon.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 512;

// ---- color helpers -------------------------------------------------------

function hexToRgb(hex) {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Multi-stop gradient: stops = [[t, [r,g,b]], ...] sorted by t ascending.
function gradientColor(stops, t) {
  t = clamp(t, 0, 1);
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const localT = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      return lerpColor(c0, c1, localT);
    }
  }
  return stops[stops.length - 1][1];
}

// Standard "over" alpha compositing: src over dst.
function over(srcColor, srcAlpha, dstColor, dstAlpha) {
  const outA = srcAlpha + dstAlpha * (1 - srcAlpha);
  if (outA <= 0) return [[0, 0, 0], 0];
  const outC = srcColor.map(
    (c, i) => (c * srcAlpha + dstColor[i] * dstAlpha * (1 - srcAlpha)) / outA
  );
  return [outC, outA];
}

// ---- shape SDFs -----------------------------------------------------------

// Inigo Quilez rounded-box SDF (2D), centered at (cx,cy).
function roundedRectSDF(px, py, cx, cy, halfW, halfH, r) {
  const dx = Math.abs(px - cx) - (halfW - r);
  const dy = Math.abs(py - cy) - (halfH - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  const outside = Math.sqrt(ax * ax + ay * ay) - r;
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside;
}

// Rotated-ellipse "r-value": 1.0 exactly on the ellipse boundary.
function ellipseR(px, py, cx, cy, rx, ry, rotationDeg) {
  const rad = (-rotationDeg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2);
}

// ---- draw the mark ---------------------------------------------------------

const badgeStops = [hexToRgb('#1e1e28'), hexToRgb('#14141e')];
const ringStops = [
  [0, hexToRgb('#38bdf8')],
  [0.45, hexToRgb('#38bdf8')],
  [0.65, hexToRgb('#c084fc')],
  [1, hexToRgb('#c084fc')],
];
const sphereStops = [
  [0, hexToRgb('#93e2ff')],
  [0.45, hexToRgb('#38bdf8')],
  [0.75, hexToRgb('#6366f1')],
  [1, hexToRgb('#8b5cf6')],
];
const dotColor = hexToRgb('#93e2ff');
const white = [255, 255, 255];

// Logo is authored in a 0-48 viewBox (see OnyxCodeLogo.tsx); map it into
// a centered square that leaves a margin inside the badge.
const MARK_SIZE = SIZE * 0.78;
const MARK_SCALE = MARK_SIZE / 48;
const MARK_OFFSET_X = (SIZE - MARK_SIZE) / 2;
const MARK_OFFSET_Y = (SIZE - MARK_SIZE) / 2;

function toMarkSpace(px, py) {
  return [(px - MARK_OFFSET_X) / MARK_SCALE, (py - MARK_OFFSET_Y) / MARK_SCALE];
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    // 1. Badge background: rounded square, diagonal gradient, antialiased edge.
    const sdf = roundedRectSDF(x + 0.5, y + 0.5, SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2, SIZE * 0.22);
    let bgAlpha = clamp(0.5 - sdf, 0, 1);
    const diagT = (x / (SIZE - 1) + y / (SIZE - 1)) / 2;
    let color = lerpColor(badgeStops[0], badgeStops[1], diagT);
    let alpha = bgAlpha;

    const [vx, vy] = toMarkSpace(x + 0.5, y + 0.5);

    // 2. Orbit ring: stroked rotated ellipse behind the sphere.
    const ringRx = 21;
    const ringRy = 7.5;
    const strokeHalfWidthR = 1.2 / ((ringRx + ringRy) / 2);
    const r = ellipseR(vx, vy, 24, 25.5, ringRx, ringRy, -16);
    const ringBand = Math.abs(r - 1);
    if (ringBand < strokeHalfWidthR * 1.6) {
      const ringAlpha = clamp(1 - ringBand / strokeHalfWidthR, 0, 1);
      // Color the ring by world-space x position (mirrors the SVG's horizontal gradient).
      const ringT = clamp(vx / 48, 0, 1);
      const ringColor = gradientColor(ringStops, ringT);
      [color, alpha] = over(ringColor, ringAlpha, color, alpha);
    }

    // 3. Sphere: filled circle with an off-center "shiny" radial gradient.
    const sphereCx = 24;
    const sphereCy = 22.5;
    const sphereR = 11.5;
    const dSphere = Math.hypot(vx - sphereCx, vy - sphereCy);
    if (dSphere < sphereR + 1) {
      const edgeAlpha = clamp((sphereR - dSphere) / 1, 0, 1);
      const focusX = sphereCx - sphereR * 0.35;
      const focusY = sphereCy - sphereR * 0.4;
      const dFocus = Math.hypot(vx - focusX, vy - focusY);
      const sphereT = clamp(dFocus / (sphereR * 1.5), 0, 1);
      const sphereColor = gradientColor(sphereStops, sphereT);
      [color, alpha] = over(sphereColor, edgeAlpha, color, alpha);
    }

    // 4. Highlight ellipse (soft gloss spot on the sphere).
    const hlR = ellipseR(vx, vy, 19.6, 18, 3.6, 2.5, 0);
    if (hlR < 1.2) {
      const hlAlpha = clamp((1.2 - hlR) / 1.2, 0, 1) * 0.32;
      [color, alpha] = over(white, hlAlpha, color, alpha);
    }

    // 5. Small satellite dot near the ring.
    const dDot = Math.hypot(vx - 42.6, vy - 19.4);
    if (dDot < 1.7 + 0.6) {
      const dotAlpha = clamp((1.7 - dDot) / 0.6 + 1, 0, 1);
      [color, alpha] = over(dotColor, dotAlpha, color, alpha);
    }

    const idx = (y * SIZE + x) * 4;
    pixels[idx] = Math.round(clamp(color[0], 0, 255));
    pixels[idx + 1] = Math.round(clamp(color[1], 0, 255));
    pixels[idx + 2] = Math.round(clamp(color[2], 0, 255));
    pixels[idx + 3] = Math.round(clamp(alpha * 255, 0, 255));
  }
}

// ---- PNG encoding (minimal, self-contained) --------------------------------

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c >>> 0;
    }
    return t;
  })());

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr.writeUInt8(8, 8); // bit depth
ihdr.writeUInt8(6, 9); // color type: RGBA
ihdr.writeUInt8(0, 10);
ihdr.writeUInt8(0, 11);
ihdr.writeUInt8(0, 12);

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y += 1) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0; // filter type: none
  pixels.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const idatData = zlib.deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE})`);
