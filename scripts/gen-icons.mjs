// Generates the app icon (original 8-bit dumbbell + rugby ball) as SVG and all PNG sizes.
// Usage: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PAL = {
  k: '#1a0b2e', // outline
  d: '#3b3f58', // dumbbell plate dark
  m: '#7c84a8', // dumbbell plate mid
  l: '#c9cfe6', // dumbbell highlight / bar
  b: '#8a4b22', // ball brown
  B: '#b8692f', // ball light
  w: '#ffffff', // laces / stripes
  y: '#ffd447', // sparkle
};

// 32×32 artwork, computed so it stays crisp: a rugby ball tilted 45° behind a horizontal dumbbell.
function buildArt() {
  const g = Array.from({ length: 32 }, () => Array(32).fill('.'));
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < 32 && y < 32) g[y][x] = c;
  };
  // Rugby ball: ellipse (a=12, b=7) rotated 45°, centred at (16, 13).
  const inBall = (x, y) => {
    const dx = x + 0.5 - 16;
    const dy = y + 0.5 - 13;
    const u = (dx + dy) / Math.SQRT2;
    const v = (dx - dy) / Math.SQRT2;
    return (u * u) / 144 + (v * v) / 49 <= 1;
  };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (inBall(x, y)) set(x, y, (x - y) > 4 ? 'b' : 'B');
  // Outline.
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (!inBall(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => inBall(x + ox, y + oy))) set(x, y, 'k');
  // White end stripes and the seam with laces along the long axis.
  for (let i = -1; i <= 1; i++) {
    set(8 + i, 6 - i, 'w');
    set(24 + i, 22 - i, 'w');
  }
  for (let i = 0; i < 7; i++) set(12 + i, 15 - i, 'w');
  for (const [x, y] of [[13, 13], [15, 11], [17, 9], [14, 15], [16, 13], [18, 11]]) set(x, y, 'w');
  set(11, 5, 'w');
  set(10, 6, 'w');

  // Dumbbell: bar across y=24..25, plates at both ends.
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
  };
  rect(4, 22, 24, 4, 'k');
  rect(5, 23, 22, 2, 'l');
  const plate = (x0, w, h) => {
    const y0 = 24 - Math.floor(h / 2);
    rect(x0 - 1, y0 - 1, w + 2, h + 2, 'k');
    rect(x0, y0, w, h, 'm');
    rect(x0, y0, 1, h, 'l');
    rect(x0 + w - 1, y0 + 1, 1, h - 1, 'd');
    rect(x0, y0 + h - 1, w, 1, 'd');
  };
  plate(2, 3, 12);
  plate(6, 3, 8);
  plate(27, 3, 12);
  plate(23, 3, 8);
  return g.map((r) => r.join(''));
}
const ART = buildArt();

function artRects(rows, ox, oy, scale) {
  let out = '';
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') out += `<rect x="${ox + x * scale}" y="${oy + y * scale}" width="${(end - x) * scale}" height="${scale}" fill="${PAL[ch]}"/>`;
      x = end;
    }
  });
  return out;
}

/** Background: magenta-to-orange stepped bands with a dithered horizon (no gradients, all pixels). */
function background(size, unit) {
  const bands = ['#ff3d7f', '#ff5a6e', '#ff7a5c', '#ff9a4a', '#ffb83a'];
  const h = size / bands.length;
  let out = bands.map((c, i) => `<rect x="0" y="${i * h}" width="${size}" height="${h + 1}" fill="${c}"/>`).join('');
  // A few sparkle pixels.
  for (const [x, y] of [[4, 4], [26, 25], [6, 28], [28, 6]]) out += `<rect x="${x * unit}" y="${y * unit}" width="${unit}" height="${unit}" fill="${PAL.y}"/>`;
  return out;
}

/** `pad` = fraction of the canvas kept free around the art (maskable icons need ~20%). */
function svg({ size = 512, pad = 0.1, rounded = false } = {}) {
  const unit = size / 32;
  const scale = Math.floor(((1 - 2 * pad) * size) / 32);
  const off = Math.round((size - scale * 32) / 2);
  const clip = rounded ? `<clipPath id="r"><rect width="${size}" height="${size}" rx="${size * 0.22}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">${clip}<g${rounded ? ' clip-path="url(#r)"' : ''}>${background(size, unit)}${artRects(ART, off, off, scale)}</g></svg>`;
}

mkdirSync('public/icons', { recursive: true });
mkdirSync('assets', { recursive: true });
const source = svg({ size: 512, pad: 0.06 });
writeFileSync('assets/icon.svg', source);
writeFileSync('public/icons/icon.svg', source);
writeFileSync('public/icons/favicon.svg', svg({ size: 64, pad: 0, rounded: true }));

const png = (s, file, size) => sharp(Buffer.from(s)).resize(size, size, { kernel: 'nearest' }).png().toFile(`public/icons/${file}`);
await Promise.all([
  png(svg({ size: 512, pad: 0.06 }), 'icon-192.png', 192),
  png(svg({ size: 512, pad: 0.06 }), 'icon-512.png', 512),
  png(svg({ size: 512, pad: 0.18 }), 'maskable-512.png', 512),
  png(svg({ size: 512, pad: 0.18 }), 'maskable-192.png', 192),
  png(svg({ size: 512, pad: 0.1 }), 'apple-touch-icon.png', 180),
  png(svg({ size: 64, pad: 0 }), 'favicon-32.png', 32),
]);
console.log('Icons written to public/icons');
