import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { LeaderboardMetric, LeaderboardScope } from '@shared/api.ts';
import { levelForXp, RANKS, rankForLevel } from '@shared/game/levels.ts';
import { addWeeks, weekKey } from '@shared/game/streak.ts';
import { tierName, TROPHIES, trophyProgress } from '@shared/game/trophies.ts';
import { Page } from '@/app/Layout.tsx';
import { Avatar, LevelBadge, TierPips, TrophyIcon, XpCard } from '@/components/game.tsx';
import { Bar, Card, cx, Empty, Loading, Segmented, Stat } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';
import { fromKg } from '@shared/units.ts';
import { fmtCompact, fmtDateLong, fmtDistance, fmtNumber } from '@/lib/format.ts';
import { useGame, useLeaderboard, useMe } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';

type Tab = 'trophies' | 'leaderboard' | 'stats';

export function ProgressPage() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'trophies';
  return (
    <Page title={t('progress.title')}>
      <Segmented<Tab>
        label={t('progress.title')}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        options={(['trophies', 'leaderboard', 'stats'] as const).map((v) => ({ value: v, label: t(`progress.tab.${v}`) }))}
      />
      <div className="mt-3">
        {tab === 'trophies' && <TrophyCabinet />}
        {tab === 'leaderboard' && <Leaderboard />}
        {tab === 'stats' && <Stats />}
      </div>
    </Page>
  );
}

function TrophyCabinet() {
  const { t, loc, lang } = useT();
  const state = useGame().data;
  if (!state) return <Loading label={t('common.loading')} />;
  const owned = Object.keys(state.trophies).length;
  return (
    <>
      <p className="mb-2 px-1 text-sm font-semibold" role="status">
        {t('trophies.unlocked', { n: owned, total: TROPHIES.length })}
      </p>
      <p className="mb-3 px-1 text-xs text-ink-soft">{t('trophies.freezeHint')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {TROPHIES.map((def) => {
          const mine = state.trophies[def.id];
          const p = trophyProgress(def, state, mine?.tier ?? 0);
          const tn = tierName(def, p.tier);
          const nextTarget = def.tiers[Math.min(p.tier, def.tiers.length - 1)]!;
          return (
            <Card as="li" key={def.id} className={cx('flex gap-3 !p-3', tn === 'locked' && 'bg-surface-2')}>
              <TrophyIcon def={def} tier={p.tier} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-[10px] leading-5">{loc(def.name)}</h3>
                  <TierPips def={def} tier={p.tier} />
                </div>
                <p className="text-sm text-ink-soft">{loc(def.desc).replace('{n}', fmtNumber(nextTarget, lang, 0))}</p>
                <p className="text-xs font-semibold">{t(`trophies.tier.${tn}`)}</p>
                {p.maxed ? (
                  <p className="text-xs font-bold text-good">✓ {t('trophies.maxed')}{mine ? ` · ${t('trophies.unlockedOn', { date: fmtDateLong(mine.at, lang) })}` : ''}</p>
                ) : (
                  <>
                    <Bar value={p.ratio} color="var(--gold)" label={loc(def.name)} />
                    <p className="text-right text-xs tabular text-ink-soft">{t('trophies.progress', { value: fmtCompact(Math.min(p.value, p.target), lang), target: fmtCompact(p.target, lang) })}</p>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    </>
  );
}

function Leaderboard() {
  const { t, lang } = useT();
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [metric, setMetric] = useState<LeaderboardMetric>('xp_all');
  const me = useMe().data;
  const { data, isLoading } = useLeaderboard(scope, metric);
  return (
    <>
      <Segmented<LeaderboardScope> label={t('progress.tab.leaderboard')} value={scope} onChange={setScope} options={(['global', 'friends'] as const).map((v) => ({ value: v, label: t(`leaderboard.scope.${v}`) }))} />
      <Segmented<LeaderboardMetric> label={t('progress.tab.leaderboard')} value={metric} onChange={setMetric} options={(['xp_all', 'xp_week', 'streak'] as const).map((v) => ({ value: v, label: t(`leaderboard.metric.${v}`) }))} />
      {me && !me.user.leaderboardVisible && <p className="my-2 border-2 border-dashed border-line p-2 text-sm">{t('leaderboard.hidden')}</p>}
      {isLoading && <Loading label={t('common.loading')} />}
      {data?.length === 0 && <Empty icon="cup">{t(scope === 'friends' ? 'leaderboard.emptyFriends' : 'leaderboard.empty')}</Empty>}
      <ol className="mt-2 space-y-2" data-testid="leaderboard">
        {data?.map((e) => (
          <li key={e.username}>
            <Link to={`/u/${e.username}`} className={cx('px px-thin flex items-center gap-3 p-2', e.isMe && 'bg-gold text-gold-ink')} aria-label={`${t('leaderboard.rank', { n: e.rank })}: ${e.username}${e.isMe ? ` (${t('leaderboard.you')})` : ''}`}>
              <span className="w-8 text-center font-pixel text-xs">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span>
              <Avatar id={e.avatar} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{e.displayName || e.username}</span>
                <span className="block truncate text-xs opacity-80">
                  @{e.username} · {t('profile.level', { level: e.level })}
                </span>
              </span>
              <span className="font-pixel text-[10px] tabular">{metric === 'streak' ? `${e.value} 🔥` : `${fmtNumber(e.value, lang, 0)} XP`}</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

function Stats() {
  const { t, tn, loc, lang } = useT();
  const units = usePrefs((s) => s.units);
  const state = useGame().data;
  if (!state) return <Loading label={t('common.loading')} />;
  const s = state.stats;
  const level = levelForXp(state.totalXp);
  const current = rankForLevel(level);
  const thisWeek = weekKey(Date.now(), -new Date().getTimezoneOffset());
  const weeks = Array.from({ length: 8 }, (_, i) => addWeeks(thisWeek, i - 7));
  const values = weeks.map((w) => state.weeks[w]?.xp ?? 0);
  const max = Math.max(1, ...values);
  return (
    <>
      <Card dialog>
        <XpCard totalXp={state.totalXp} />
      </Card>
      <h2 className="mb-2 mt-5 px-1 text-[11px]">{t('stats.weeklyXp')}</h2>
      <Card>
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label={t('stats.weeklyXpAlt', { values: values.join(', ') })}>
          {values.map((v, i) => (
            <div key={weeks[i]} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold tabular">{v || ''}</span>
              <div className="w-full border-2 border-line bg-[var(--xp)]" style={{ height: `${Math.max(2, (v / max) * 88)}px` }} />
            </div>
          ))}
        </div>
      </Card>
      <h2 className="mb-2 mt-5 px-1 text-[11px]">{t('stats.lifetime')}</h2>
      <div className="grid grid-cols-2 gap-1">
        <Stat label={t('stats.workouts')} value={s.workouts} />
        <Stat label={t('stats.bestStreak')} value={tn('unit.week', s.bestStreak)} />
        <Stat label={t('stats.volume')} value={`${fmtCompact(fromKg(s.volumeKg, units), lang)} ${units}`} />
        <Stat label={t('stats.sets')} value={fmtCompact(s.sets, lang)} />
        <Stat label={t('stats.reps')} value={fmtCompact(s.reps, lang)} />
        <Stat label={t('stats.pbs')} value={s.pbs} />
        <Stat label={t('stats.distance')} value={fmtDistance(s.cardioDistanceM, units, lang)} />
        <Stat label={t('stats.cardioTime')} value={`${fmtNumber(s.cardioMinutes, lang, 0)} ${t('unit.min')}`} />
      </div>
      <h2 className="mb-2 mt-5 px-1 text-[11px]">{t('stats.ranks')}</h2>
      <ol className="space-y-1.5">
        {RANKS.map((r) => {
          const reached = level >= r.minLevel;
          const isCurrent = r.id === current.id;
          return (
            <li key={r.id} className={cx('flex items-center gap-3 border-2 border-line p-2', isCurrent ? 'bg-gold text-gold-ink' : reached ? 'bg-surface' : 'bg-surface-2 opacity-70')}>
              <LevelBadge level={r.minLevel} size={28} />
              <span className="flex-1 font-semibold">{loc(r.name)}</span>
              <span className="text-xs font-semibold">{isCurrent ? `▶ ${t('stats.rankCurrent')}` : reached ? '✓' : t('stats.rankAt', { level: r.minLevel })}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
