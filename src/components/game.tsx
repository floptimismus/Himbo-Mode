import { levelProgress, rankForLevel, rankIndex } from '@shared/game/levels.ts';
import { tierName, type TrophyDef } from '@shared/game/trophies.ts';
import { useT } from '@/i18n/index.ts';
import { fmtNumber } from '@/lib/format.ts';
import { FLAME, FLAME_OFF, PixelSprite, tint } from './pixel/PixelSprite.tsx';
import { avatarSprite } from './pixel/sprites.ts';
import { Bar, cx } from './ui.tsx';

export function Avatar({ id, size = 48, label }: { id: string; size?: number; label?: string }) {
  const a = avatarSprite(id);
  return (
    <span className="px px-thin px-flat inline-block shrink-0 leading-[0]" style={{ background: a.tile }}>
      <PixelSprite sprite={a.rows} palette={a.palette} size={size} label={label} />
    </span>
  );
}

const RANK_COLORS = [
  '#9aa3b5', '#7fb069', '#4fa3a5', '#3567d6', '#7a3fc4', '#c44fb0', '#d92f5f', '#f0642f',
  '#f5bd1f', '#2c8443', '#157a76', '#5aa9ff', '#b266ff', '#ff5c9a', '#ff9d5c', '#ffd447',
];

/** Pixel shield with the level number; the color follows the rank. */
export function LevelBadge({ level, size = 48 }: { level: number; size?: number }) {
  const { t } = useT();
  const color = RANK_COLORS[rankIndex(level) % RANK_COLORS.length]!;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={t('profile.level', { level })}>
      <PixelSprite sprite="badge" size={size} palette={{ k: 'var(--line)', x: color, w: 'rgb(255 255 255 / 0.55)' }} />
      <span className="absolute font-pixel text-white [text-shadow:1px_1px_0_#000,-1px_1px_0_#000,1px_-1px_0_#000,-1px_-1px_0_#000]" style={{ fontSize: Math.max(8, size * (level > 9 ? 0.26 : 0.32)), top: size * 0.24 }} aria-hidden="true">
        {level}
      </span>
    </span>
  );
}

/** Level, rank title and XP bar. */
export function XpCard({ totalXp, compact }: { totalXp: number; compact?: boolean }) {
  const { t, loc, lang } = useT();
  const p = levelProgress(totalXp);
  const rank = rankForLevel(p.level);
  return (
    <div className="flex items-center gap-3">
      <LevelBadge level={p.level} size={compact ? 40 : 56} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-pixel text-[10px] leading-5">{loc(rank.name)}</span>
          <span className="shrink-0 text-xs font-semibold tabular text-ink-soft">
            {fmtNumber(totalXp, lang, 0)} {t('unit.xp')}
          </span>
        </div>
        <Bar value={p.ratio} label={t('unit.xp')} />
        <div className="mt-1 text-xs text-ink-soft tabular">
          {p.needed > 0 ? t('home.xpToNext', { xp: fmtNumber(p.needed - p.current, lang, 0), level: p.level + 1 }) : t('home.maxLevel')}
        </div>
      </div>
    </div>
  );
}

export function Flame({ lit, size = 32, animate = true }: { lit: boolean; size?: number; animate?: boolean }) {
  return <PixelSprite sprite="flame" size={size} palette={lit ? FLAME : FLAME_OFF} className={cx(lit && animate && 'anim-flicker')} />;
}

const TIER_VAR = { bronze: 'var(--tier-bronze)', silver: 'var(--tier-silver)', gold: 'var(--tier-gold)', locked: 'var(--tier-locked)' } as const;

/** Trophy sprite tinted by tier; locked trophies are greyed and carry a lock. */
export function TrophyIcon({ def, tier, size = 40 }: { def: TrophyDef; tier: number; size?: number }) {
  const name = tierName(def, tier);
  return (
    <span className="relative inline-flex shrink-0">
      <PixelSprite sprite={def.icon === 'scroll' ? 'scroll' : def.icon} size={size} palette={{ ...tint(TIER_VAR[name], name === 'locked' ? 'var(--surface-2)' : 'var(--primary)'), ...(name === 'locked' ? { k: 'var(--ink-soft)' } : {}) }} className={cx(name === 'locked' && 'opacity-60')} />
      {name === 'locked' && (
        <span className="absolute -bottom-1 -right-1 bg-surface p-0.5 text-ink">
          <PixelSprite sprite="lock" size={12} />
        </span>
      )}
    </span>
  );
}

/** Three pips showing which tiers of a multi-tier trophy are owned (with text for a11y). */
export function TierPips({ def, tier }: { def: TrophyDef; tier: number }) {
  const { t } = useT();
  if (def.tiers.length === 1) return null;
  const names = ['bronze', 'silver', 'gold'] as const;
  return (
    <span className="inline-flex gap-1" role="img" aria-label={t(`trophies.tier.${tierName(def, tier)}`)}>
      {names.map((n, i) => (
        <span key={n} className="h-2.5 w-2.5 border border-line" style={{ background: i < tier ? TIER_VAR[n] : 'transparent' }} />
      ))}
    </span>
  );
}

/** Burst of square confetti that moves in steps. Purely decorative. */
export function Confetti({ count = 28 }: { count?: number }) {
  const colors = ['var(--primary)', 'var(--gold)', 'var(--accent)', 'var(--xp)', 'var(--good)'];
  return (
    <span className="confetti pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 60 + ((i * 37) % 80);
        return (
          <i
            key={i}
            style={{
              background: colors[i % colors.length],
              ['--dx' as string]: `${Math.round(Math.cos(angle) * dist)}px`,
              ['--dy' as string]: `${Math.round(Math.sin(angle) * dist - 30)}px`,
              animationDelay: `${(i % 5) * 60}ms`,
            }}
          />
        );
      })}
    </span>
  );
}
