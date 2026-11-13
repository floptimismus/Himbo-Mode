import type { ReactNode } from 'react';
import { muscleLoad, workoutTotals } from '@shared/game/engine.ts';
import { rankForLevel } from '@shared/game/levels.ts';
import { tierName, TROPHY_BY_ID } from '@shared/game/trophies.ts';
import type { NewPb, WorkoutSummary, XpBreakdown } from '@shared/game/types.ts';
import type { WorkoutInput } from '@shared/schemas.ts';
import { Confetti, Flame, TrophyIcon, XpCard } from '@/components/game.tsx';
import { MuscleMap } from '@/components/MuscleMap.tsx';
import { PixelSprite, tint } from '@/components/pixel/PixelSprite.tsx';
import { Button, Card, SectionTitle, Stat } from '@/components/ui.tsx';
import { useT, type Key } from '@/i18n/index.ts';
import { fmtDate, fmtDistance, fmtDuration, fmtNumber, fmtPb, fmtSet, fmtTime, fmtWeight } from '@/lib/format.ts';
import { syncOutbox, useExercises } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { toGame } from './model.ts';

interface Props {
  name: string;
  startedAt: number;
  durationS: number;
  exercises: WorkoutInput['exercises'];
  /** Server-computed result; null while the workout is still waiting to sync. */
  summary: WorkoutSummary | null;
  /** Celebration mode shows the hero, confetti and unlock animations. */
  celebrate?: boolean;
  actions: ReactNode;
}

const XP_ROWS: Array<[keyof XpBreakdown, Key]> = [
  ['sets', 'summary.xp.sets'], ['cardio', 'summary.xp.cardio'], ['streak', 'summary.xp.streak'], ['pb', 'summary.xp.pb'],
  ['duration', 'summary.xp.duration'], ['weeklyGoal', 'summary.xp.weeklyGoal'],
];

/** Post-workout summary; also used as the history detail view. */
export function SummaryView({ name, startedAt, durationS, exercises, summary, celebrate, actions }: Props) {
  const { t, tn, loc, lang } = useT();
  const units = usePrefs((s) => s.units);
  const { byId, metaOf } = useExercises();
  const game = toGame(exercises);
  const totals = summary ?? workoutTotals(game, metaOf);
  const muscles = summary?.muscles ?? muscleLoad(game, metaOf);
  const leveled = !!summary && summary.levelAfter > summary.levelBefore;
  const newRank = leveled && rankForLevel(summary.levelAfter).id !== rankForLevel(summary.levelBefore).id;
  const pbsByExercise = new Map<string, NewPb[]>();
  for (const p of summary?.pbs ?? []) pbsByExercise.set(p.exerciseId, [...(pbsByExercise.get(p.exerciseId) ?? []), p]);

  return (
    <div>
      {celebrate ? (
        <div className="relative mb-4 flex flex-col items-center gap-3 pt-4 text-center">
          <span className="relative">
            <PixelSprite sprite="star" size={64} palette={tint('var(--gold)')} className="anim-pop" />
            {summary && <Confetti />}
          </span>
          <h2 className="text-sm text-primary [text-shadow:2px_2px_0_var(--line)]">{t('summary.title')}</h2>
          <p className="font-semibold">{name}</p>
        </div>
      ) : (
        <p className="mb-3 px-1 text-sm font-semibold text-ink-soft">
          {fmtDate(startedAt, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {fmtTime(startedAt, lang)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <Stat label={t('summary.duration')} value={fmtDuration(durationS)} />
        <Stat label={t('summary.volume')} value={fmtWeight(totals.volumeKg, units, lang)} />
        <Stat label={t('summary.sets')} value={totals.sets} />
        <Stat label={t('summary.reps')} value={fmtNumber(totals.reps, lang, 0)} />
        {totals.distanceM > 0 && <Stat className="col-span-2" label={t('summary.distance')} value={fmtDistance(totals.distanceM, units, lang)} />}
      </div>

      {!summary && (
        <Card className="mt-4 border-gold" dialog>
          <p className="mb-3 text-sm font-semibold">{t(navigator.onLine ? 'summary.pending' : 'sync.offline')}</p>
          <Button small block onClick={() => void syncOutbox()}>
            {t('summary.syncNow')}
          </Button>
        </Card>
      )}

      {summary && (
        <>
          <SectionTitle>{t('summary.xp')}</SectionTitle>
          <Card dialog>
            <p className="mb-3 text-center font-pixel text-xl text-[var(--xp)] [text-shadow:2px_2px_0_var(--line)]" data-testid="xp-total">
              +{summary.xp.total} {t('unit.xp')}
            </p>
            <dl className="mb-4 text-sm">
              {XP_ROWS.filter(([k]) => (summary.xp[k] as number) > 0).map(([k, label]) => (
                <div key={k} className="flex justify-between border-b border-dashed border-line/40 py-1">
                  <dt>{t(label)}</dt>
                  <dd className="font-bold tabular">+{summary.xp[k] as number}</dd>
                </div>
              ))}
              {summary.xp.total < summary.xp.raw && (
                <div className="flex justify-between border-b border-dashed border-line/40 py-1">
                  <dt>{t('summary.xp.cap')}</dt>
                  <dd className="font-bold tabular">−{summary.xp.raw - summary.xp.total}</dd>
                </div>
              )}
            </dl>
            {celebrate && <XpCard totalXp={summary.totalXp} />}
            {leveled && (
              <div className="mt-4 bg-gold p-3 text-center text-gold-ink" role="status">
                <p className="font-pixel text-[10px] leading-5 anim-blink">▲ {t('summary.levelUp', { level: summary.levelAfter })}</p>
                {newRank && <p className="mt-1 font-bold">{t('summary.newRank', { rank: loc(rankForLevel(summary.levelAfter).name) })}</p>}
              </div>
            )}
          </Card>

          {celebrate && (
            <>
              <SectionTitle>{t('summary.streak')}</SectionTitle>
              <Card className="flex items-center gap-3">
                <Flame lit={summary.streak.after > 0} size={40} />
                <div>
                  <p className="font-pixel text-xs">{tn('unit.week', summary.streak.after)}</p>
                  <p className="text-sm text-ink-soft">{summary.streak.goalHitNow ? t('summary.goalHit') : t('summary.weekProgress', { done: summary.streak.weekWorkouts, goal: summary.streak.goal })}</p>
                </div>
              </Card>
            </>
          )}

          {summary.trophies.length > 0 && (
            <>
              <SectionTitle>{t('summary.trophies')}</SectionTitle>
              <ul className="space-y-3">
                {summary.trophies.map((u, i) => {
                  const def = TROPHY_BY_ID.get(u.id);
                  if (!def) return null;
                  return (
                    <Card as="li" key={u.id} className="flex items-center gap-3">
                      <span className={celebrate ? 'anim-pop' : ''} style={{ animationDelay: `${300 + i * 200}ms` }}>
                        <TrophyIcon def={def} tier={u.tier} size={44} />
                      </span>
                      <div>
                        <p className="font-pixel text-[10px] leading-5">{loc(def.name)}</p>
                        <p className="text-sm text-ink-soft">
                          {def.tiers.length > 1 && <strong>{t(`trophies.tier.${tierName(def, u.tier)}`)} · </strong>}
                          {loc(def.desc).replace('{n}', fmtNumber(def.tiers[u.tier - 1] ?? 0, lang, 0))}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </ul>
            </>
          )}

          {pbsByExercise.size > 0 && (
            <>
              <SectionTitle>{t('summary.pbs')}</SectionTitle>
              <ul className="space-y-3" data-testid="pb-list">
                {[...pbsByExercise].map(([exerciseId, list]) => {
                  const ex = byId.get(exerciseId);
                  if (!ex) return null;
                  return (
                    <Card as="li" key={exerciseId}>
                      <p className="mb-1 flex items-center gap-2 font-pixel text-[10px] leading-5">
                        <PixelSprite sprite="medal" size={18} palette={tint('var(--gold)')} className={celebrate ? 'anim-bob' : ''} />
                        {loc(ex.name)}
                      </p>
                      <dl className="text-sm">
                        {list.map((p) => (
                          <div key={p.kind} className="flex items-baseline justify-between gap-2 py-0.5">
                            <dt>{t(`summary.pb.${p.kind}`)}</dt>
                            <dd className="text-right">
                              <strong className="tabular">{fmtPb(p.kind, p.value, ex.tracking, units, lang, t('unit.reps'))}</strong>
                              <span className="ml-2 text-xs text-ink-soft">
                                {p.previous == null ? t('summary.pb.first') : t('summary.pb.before', { value: fmtPb(p.kind, p.previous, ex.tracking, units, lang, t('unit.reps')) })}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </Card>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}

      {Object.keys(muscles).length > 0 && (
        <>
          <SectionTitle>{t('summary.muscles')}</SectionTitle>
          <Card>
            <MuscleMap load={muscles} />
          </Card>
        </>
      )}

      <SectionTitle>{t('summary.exercises')}</SectionTitle>
      <ul className="space-y-3">
        {exercises.map((ex, i) => {
          const def = byId.get(ex.exerciseId);
          return (
            <Card as="li" key={i} className="!p-3">
              <p className="font-semibold">{def ? loc(def.name) : ex.exerciseId}</p>
              {ex.notes && <p className="text-sm italic text-ink-soft">{ex.notes}</p>}
              <ol className="mt-1 text-sm tabular">
                {ex.sets.map((s, j) => (
                  <li key={j} className="flex gap-2 py-0.5">
                    <span className="w-6 shrink-0 font-bold text-ink-soft">{j + 1}</span>
                    <span>{def ? fmtSet(def.tracking, s, units, lang, t('unit.reps')) : ''}</span>
                    {s.type !== 'normal' && <span className="text-xs font-semibold text-ink-soft">({t(`workout.type.${s.type}`)})</span>}
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </ul>

      <div className="mt-6 space-y-2">{actions}</div>
    </div>
  );
}
