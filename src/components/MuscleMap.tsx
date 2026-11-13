import { memo, useId } from 'react';
import { MUSCLES, type Muscle } from '@shared/data/types.ts';
import { useT } from '@/i18n/index.ts';

/**
 * Original pixel-art body, front and back. Each row is the left half of the figure and is
 * mirrored. '#' is neutral body, letters are muscle regions (see CODE), '.' is empty.
 */
const HEAD = ['........###', '.......####', '.......####', '.......####', '........###', '.........nn'];
const LOWER_LEG = ['......###..', '......###..', '......kkk..', '.....kkkk..', '.....kkkk..', '.....kkkk..', '......kkk..', '......kkk..', '......###..', '.....####..'];
const FRONT = [
  ...HEAD,
  '.....ttttnn', '..ssssccccc', '.sssscccccc', '.ssbbcccccc', '.bbb.cccccc', '.bbb.oaaaaa', '.bbb.ooaaaa', '.fff.ooaaaa', '.fff.ooaaaa',
  '.fff.ooaaaa', '.fff..oaaaa', '.###..qqaaa', '.###.qqqqdd', '.....qqqqdd', '.....qqqqdd', '.....qqqqdd', '.....qqqqd.', '.....qqqqd.',
  '.....qqqq..', '......qqq..',
  ...LOWER_LEG,
];
const BACK = [
  ...HEAD,
  '.....ttttnn', '..ssssttttt', '.ssssuuuuut', '.ssrruuuuut', '.rrr.lluuut', '.rrr.llluuu', '.rrr.lllluu', '.fff.llllww', '.fff.olllww',
  '.fff.oolwww', '.fff..owwww', '.###..ggggg', '.###.gggggg', '.....gggggg', '.....gggggg', '.....hhhhdd', '.....hhhhd.', '.....hhhhd.',
  '.....hhhh..', '......hhh..',
  ...LOWER_LEG,
];

const CODE: Record<string, Muscle> = {
  n: 'neck', t: 'traps', s: 'shoulders', c: 'chest', b: 'biceps', r: 'triceps', f: 'forearms', a: 'abs', o: 'obliques',
  l: 'lats', u: 'upper_back', w: 'lower_back', g: 'glutes', q: 'quads', h: 'hamstrings', k: 'calves', d: 'adductors',
};

type Level = 0 | 1 | 2 | 3;
const mirror = (half: string) => half + [...half].reverse().join('');

function Figure({ rows, levels, patternId, label }: { rows: string[]; levels: Partial<Record<Muscle, Level>>; patternId: string; label: string }) {
  const full = rows.map(mirror);
  const w = 22;
  const h = full.length;
  const cells: Array<{ x: number; y: number; w: number; fill: string }> = [];
  const outline: Array<{ x: number; y: number; w: number }> = [];
  full.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (ch !== '.') {
        const muscle = CODE[ch];
        const level = muscle ? (levels[muscle] ?? 0) : 0;
        const fill = !muscle ? 'var(--muscle-body)' : level === 3 ? 'var(--muscle-hi)' : level === 2 ? 'var(--muscle-mid)' : level === 1 ? `url(#${patternId})` : 'var(--muscle-base)';
        cells.push({ x, y, w: end - x, fill });
        outline.push({ x, y, w: end - x });
      }
      x = end;
    }
  });
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg className="sprite h-auto w-full max-w-[150px]" viewBox={`-1 -1 ${w + 2} ${h + 2}`} aria-hidden="true">
        {outline.map((r, i) => (
          <rect key={`o${i}`} x={r.x - 0.5} y={r.y - 0.5} width={r.w + 1} height={2} fill="var(--line)" />
        ))}
        {cells.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1.02} fill={r.fill} />
        ))}
      </svg>
      <figcaption className="font-pixel text-[8px] text-ink-soft">{label}</figcaption>
    </figure>
  );
}

interface Props {
  /** Exercise view: strong color for primary, dithered for secondary muscles. */
  primary?: readonly Muscle[];
  secondary?: readonly Muscle[];
  /** Workout view: training load per muscle, shown in three intensity steps. */
  load?: Partial<Record<Muscle, number>>;
  /** Hide the text legend (when the muscles are already listed next to the map). */
  hideLegend?: boolean;
}

/** Reusable pixel-art muscle map (front + back) with a text legend so color is never the only cue. */
export const MuscleMap = memo(function MuscleMap({ primary, secondary, load, hideLegend }: Props) {
  const { t } = useT();
  const patternId = useId();
  const levels: Partial<Record<Muscle, Level>> = {};
  if (load) {
    const max = Math.max(0, ...Object.values(load));
    for (const m of MUSCLES) {
      const v = load[m] ?? 0;
      if (v > 0 && max > 0) levels[m] = v / max >= 0.66 ? 3 : v / max >= 0.33 ? 2 : 1;
    }
  } else {
    for (const m of secondary ?? []) levels[m] = 1;
    for (const m of primary ?? []) levels[m] = 3;
  }
  const byLevel = (l: Level) => MUSCLES.filter((m) => levels[m] === l);
  const legend: Array<{ level: Level; label: string; swatch: string }> = load
    ? [
        { level: 3, label: t('map.level.high'), swatch: 'var(--muscle-hi)' },
        { level: 2, label: t('map.level.mid'), swatch: 'var(--muscle-mid)' },
        { level: 1, label: t('map.level.low'), swatch: 'dither' },
      ]
    : [
        { level: 3, label: t('library.primary'), swatch: 'var(--muscle-hi)' },
        { level: 1, label: t('library.secondary'), swatch: 'dither' },
      ];
  const names = legend.flatMap((l) => byLevel(l.level).map((m) => `${t(`muscle.${m}`)} (${l.label})`));

  return (
    <div>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          {/* Checkerboard dither: the "light" color of the pixel world. */}
          <pattern id={patternId} width="1" height="1" patternUnits="userSpaceOnUse">
            <rect width="1" height="1" fill="var(--muscle-base)" />
            <rect width="0.5" height="0.5" fill="var(--muscle-lo)" />
            <rect x="0.5" y="0.5" width="0.5" height="0.5" fill="var(--muscle-lo)" />
          </pattern>
        </defs>
      </svg>
      <div className="grid grid-cols-2 justify-items-center gap-4" role="img" aria-label={`${t('map.alt')}: ${names.join(', ') || t('map.none')}`}>
        <Figure rows={FRONT} levels={levels} patternId={patternId} label={t('map.front')} />
        <Figure rows={BACK} levels={levels} patternId={patternId} label={t('map.back')} />
      </div>
      {!hideLegend && (
        <ul className="mt-3 space-y-1 text-sm">
          {legend.map((l) => {
            const list = byLevel(l.level);
            if (!list.length) return null;
            return (
              <li key={l.level} className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 border border-line"
                  style={l.swatch === 'dither' ? { backgroundColor: 'var(--muscle-base)', backgroundImage: 'linear-gradient(45deg, var(--muscle-lo) 25%, transparent 25%, transparent 75%, var(--muscle-lo) 75%), linear-gradient(45deg, var(--muscle-lo) 25%, transparent 25%, transparent 75%, var(--muscle-lo) 75%)', backgroundSize: '4px 4px', backgroundPosition: '0 0, 2px 2px' } : { background: l.swatch }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{l.label}:</strong> {list.map((m) => t(`muscle.${m}`)).join(', ')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

/** Exposed for tests: every grid row must be exactly 11 characters. */
export const MUSCLE_GRIDS = { FRONT, BACK };
