import { Link } from 'react-router';
import { Page } from '@/app/Layout.tsx';
import { Flame, XpCard } from '@/components/game.tsx';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { Bar, Button, Card, Empty, Loading, SectionTitle } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';
import { useMe, useRoutines, useWorkouts } from '@/lib/queries.ts';
import { useLive } from '@/stores/live.ts';
import { RoutineCard } from '../routines/RoutineCard.tsx';
import { useStartWorkout } from '../workout/WorkoutPage.tsx';
import { WorkoutRow } from '../workout/pages.tsx';

export function HomePage() {
  const { t, tn } = useT();
  const me = useMe().data;
  const routines = useRoutines().data ?? [];
  const workouts = useWorkouts();
  const live = useLive((s) => !!s.active);
  const start = useStartWorkout();

  if (!me) return <Loading label={t('common.loading')} />;
  const { user, game } = me;
  const name = user.displayName || user.username;

  return (
    <Page title="HIMBO-MODE">
      <h2 className="mb-3 px-1 text-sm">{t('home.greeting', { name })}</h2>

      <Card dialog>
        <XpCard totalXp={game.totalXp} />
      </Card>

      <Card className="mt-4" dialog>
        <div className="flex items-center gap-3">
          <Flame lit={game.streak > 0} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-soft">{t('home.streak')}</p>
            <p className="font-pixel text-sm" data-testid="streak">
              {tn('unit.week', game.streak)}
            </p>
          </div>
          {game.freezes > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[var(--xp)]" title={tn('home.freezes', game.freezes)}>
              <PixelSprite sprite="snow" size={14} />
              <span className="sr-only">{tn('home.freezes', game.freezes)}</span>
              <span aria-hidden="true">×{game.freezes}</span>
            </span>
          )}
        </div>
        <p className="mt-3 text-sm font-semibold tabular">{t('home.thisWeek', { done: game.weekWorkouts, goal: game.weekGoal })}</p>
        <Bar value={game.weekWorkouts / game.weekGoal} color={game.weekMet ? 'var(--good)' : game.inDanger ? 'var(--bad)' : 'var(--gold)'} label={t('home.thisWeek', { done: game.weekWorkouts, goal: game.weekGoal })} />
        {game.weekMet && <p className="mt-1 text-sm font-bold text-good">✓ {t('home.weekDone')}</p>}
        {!game.weekMet && game.inDanger && <p className="anim-blink mt-1 text-sm font-bold text-bad">⚠ {t('home.inDanger')}</p>}
      </Card>

      <Button variant="primary" block className="mt-5" icon="play" onClick={() => start()}>
        {t(live ? 'home.resume' : 'home.start')}
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to="/library" className="px-btn small">
          <PixelSprite sprite="search" size={12} />
          {t('home.library')}
        </Link>
        <Link to="/history" className="px-btn small">
          <PixelSprite sprite="clock" size={12} palette={{ k: 'currentColor', x: 'transparent' }} />
          {t('home.history')}
        </Link>
      </div>

      {routines.length > 0 && (
        <>
          <SectionTitle action={<Link to="/routines" className="text-sm font-semibold underline">{t('home.seeAll')}</Link>}>{t('home.routines')}</SectionTitle>
          <ul className="space-y-3">
            {routines.slice(0, 3).map((r) => (
              <RoutineCard key={r.id} routine={r} onStart={() => start(r)} />
            ))}
          </ul>
        </>
      )}

      <SectionTitle action={workouts.data?.length ? <Link to="/history" className="text-sm font-semibold underline">{t('home.seeAll')}</Link> : undefined}>{t('home.recent')}</SectionTitle>
      {workouts.data?.length === 0 && <Empty icon="cup">{t('home.noWorkouts')}</Empty>}
      <ul className="space-y-3">{workouts.data?.slice(0, 3).map((w) => <WorkoutRow key={w.id} w={w} to={`/history/${w.id}`} />)}</ul>
    </Page>
  );
}
