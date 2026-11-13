import { memo } from 'react';
import { SPRITES, type SpriteName } from './sprites.ts';

interface Props {
  /** A named sprite or raw rows. */
  sprite: SpriteName | readonly string[];
  /** Maps grid characters to colors. Unmapped characters use currentColor. */
  palette?: Record<string, string>;
  /** Rendered height in px; width follows the grid's aspect ratio. */
  size?: number;
  className?: string;
  /** Accessible name. Without it the sprite is decorative and hidden from assistive tech. */
  label?: string;
}

/** Renders a character grid as crisp SVG rects, merging horizontal runs of the same color. */
export const PixelSprite = memo(function PixelSprite({ sprite, palette, size = 24, className, label }: Props) {
  const rows = typeof sprite === 'string' ? SPRITES[sprite] : sprite;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rects: Array<{ x: number; y: number; w: number; c: string }> = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') rects.push({ x, y, w: end - x, c: palette?.[ch] ?? 'currentColor' });
      x = end;
    }
  });
  return (
    <svg
      className={`sprite shrink-0 ${className ?? ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={(size * w) / h}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1.02} fill={r.c} />
      ))}
    </svg>
  );
});

/** Palette for the outlined multi-color sprites (trophies, flame, …). */
export const tint = (fill: string, second = 'var(--primary)'): Record<string, string> => ({
  k: 'var(--line)',
  x: fill,
  w: 'rgb(255 255 255 / 0.75)',
  y: second,
  r: 'var(--primary)',
});

export const FLAME = { r: '#f0642f', y: '#f5bd1f', w: '#fff6c9' };
export const FLAME_OFF = { r: 'var(--tier-locked)', y: 'var(--surface-2)', w: 'var(--surface)' };
