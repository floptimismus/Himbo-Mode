import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Routine } from '@shared/api.ts';
import type { Exercise } from '@shared/data/types.ts';
import { LIMITS } from '@shared/game/constants.ts';
import { isTimeBased } from '@shared/game/xp.ts';
import { Page } from '@/app/Layout.tsx';
import { Sheet } from '@/components/glass/dialog.tsx';
import { confirm, toast } from '@/components/glass/feedback.tsx';
import { Button, Card, Empty, SectionTitle } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';
import { fmtClock } from '@/lib/format.ts';
import { syncOutbox, useExercises, useLibrary, useRoutines, type ExerciseIndex } from '@/lib/queries.ts';
import { useLive, type LiveExercise } from '@/stores/live.ts';
import { useOutbox } from '@/stores/outbox.ts';
import { usePrefs } from '@/stores/prefs.ts';
import type { LibraryState } from '@shared/api.ts';
import { ExerciseDetail, ExercisePicker } from '../exercises/sheets.tsx';
import { RoutineCard } from '../routines/RoutineCard.tsx';
import { ExerciseBlock, moveBlock } from './ExerciseBlock.tsx';
import { blockFor, countSets, defaultWorkoutName, toWorkoutInput } from './model.ts';
import { RestTimer } from './RestTimer.tsx';

/** Blocks for a routine, pre-filled with targets and the last performance. */
export function blocksForRoutine(routine: Routine, index: ExerciseIndex, library: LibraryState | undefined): LiveExercise[] {
  return routine.exercises.flatMap((re) => {
    const ex = index.byId.get(re.exerciseId);
    return ex ? [blockFor(ex, library?.lastPerf[re.exerciseId], re)] : [];
  });
}

/** Start a workout from anywhere; asks before replacing nothing – a running workout always wins. */
export function useStartWorkout() {
  const { t } = useT();
  const navigate = useNavigate();
  const index = useExercises();
  const library = useLibrary().data;
  return (routine?: Routine) => {
    if (useLive.getState().active) {
      if (routine) toast(t('routines.replaceActive'), 'clock');
      navigate('/workout');
      return;
    }
    useLive.getState().start(routine?.name ?? defaultWorkoutName(t), routine ? blocksForRoutine(routine, index, library) : [], routine?.id ?? null);
    navigate('/workout');
  };
}

/** Ticks once a second; the value is always computed from the stored start timestamp. */
function useElapsed(startedAt: number | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

export function WorkoutPage() {
  const active = useLive((s) => s.active);
  return active ? <LiveWorkout /> : <StartScreen />;
}

function StartScreen() {
  const { t } = useT();
  const start = useStartWorkout();
  const routines = useRoutines().data ?? [];
  return (
    <Page title={t('workout.title')}>
      <Card dialog className="text-center">
        <h2 className="mb-4 text-sm">{t('workout.startTitle')}</h2>
        <Button variant="primary" block icon="play" onClick={() => start()}>
          {t('workout.startEmpty')}
        </Button>
      </Card>
      {routines.length > 0 && (
        <>
          <SectionTitle>{t('workout.fromRoutine')}</SectionTitle>
          <ul className="space-y-3">
            {routines.map((r) => (
              <RoutineCard key={r.id} routine={r} onStart={() => start(r)} />
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

function LiveWorkout() {
  const { t, tn } = useT();
  const navigate = useNavigate();
  const active = useLive((s) => s.active)!;
  const setExercises = useLive((s) => s.setExercises);
  const setName = useLive((s) => s.setName);
  const index = useExercises();
  const library = useLibrary().data;
  const elapsed = useElapsed(active.startedAt);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const { done, undone } = countSets(active.exercises);

  const addExercises = (ids: string[]) => {
    setExercises((prev) => [...prev, ...ids.flatMap((id) => (index.byId.get(id) ? [blockFor(index.byId.get(id)!, library?.lastPerf[id])] : []))].slice(0, LIMITS.exercisesPerWorkout));
    setPicker(false);
  };

  const finish = () => {
    const input = toWorkoutInput(active, Date.now(), defaultWorkoutName(t));
    useOutbox.getState().enqueue(input);
    useLive.getState().discard();
    void syncOutbox();
    navigate(`/workout/done/${input.id}`, { replace: true });
  };

  const discard = async () => {
    if (await confirm({ title: t('workout.discard'), message: t('workout.discardConfirm'), danger: true, confirmLabel: t('workout.discard') })) useLive.getState().discard();
  };

  return (
    <Page
      title={t('workout.title')}
      actions={
        <button type="button" className="mr-1 min-h-10 rounded-full bg-primary px-4 font-pixel text-[9px] text-primary-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]" onClick={() => setFinishing(true)}>
          {t('workout.finish')}
        </button>
      }
      headerExtra={
        <div className="flex items-center justify-between gap-3 px-2 pb-2">
          <span className="font-pixel text-lg tabular" role="timer" aria-label={t('workout.elapsed')} data-testid="workout-timer">
            {fmtClock(elapsed)}
          </span>
          <span className="text-xs font-semibold text-ink-soft tabular">
            ✓ {done} / {done + undone} {t('summary.sets')}
          </span>
        </div>
      }
    >
      <input className="px-input mb-4 font-semibold" aria-label={t('workout.name')} maxLength={LIMITS.nameLength} value={active.name} onChange={(e) => setName(e.target.value)} />

      {active.exercises.length === 0 && <Empty icon="weight">{t('workout.empty')}</Empty>}

      {active.exercises.map((block, i) => {
        const ex = index.byId.get(block.exerciseId);
        return (
          <ExerciseBlock
            key={block.uid}
            live
            block={block}
            exercise={ex}
            last={library?.lastPerf[block.exerciseId]}
            canUp={i > 0}
            canDown={i < active.exercises.length - 1}
            onChange={(b) => setExercises((prev) => prev.map((x) => (x.uid === b.uid ? b : x)))}
            onRemove={() => setExercises((prev) => prev.filter((x) => x.uid !== block.uid))}
            onMove={(dir) => setExercises((prev) => moveBlock(prev, i, dir))}
            onInfo={() => ex && setDetail(ex)}
            onSetDone={() => {
              const prefs = usePrefs.getState();
              if (prefs.restEnabled && ex && !isTimeBased(ex.tracking)) useLive.getState().startRest(prefs.restSeconds);
            }}
          />
        );
      })}

      <Button variant="accent" block icon="plus" onClick={() => setPicker(true)}>
        {t('workout.addExercise')}
      </Button>
      <button type="button" className="mt-6 min-h-11 w-full text-center text-sm font-semibold text-bad underline" onClick={discard}>
        {t('workout.discard')}
      </button>

      <RestTimer />
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onAdd={addExercises} />
      <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title={t('workout.finishTitle')}
        footer={
          <div className="flex gap-2">
            <Button block onClick={() => setFinishing(false)}>
              {t('common.cancel')}
            </Button>
            <Button block variant="primary" icon="check" onClick={finish}>
              {t('workout.finish')}
            </Button>
          </div>
        }
      >
        <p className="font-pixel text-base tabular">{fmtClock(elapsed)}</p>
        <p className="mt-3">{done === 0 ? t('workout.finishEmpty') : undone > 0 ? tn('workout.finishUndone', undone) : t('workout.finishAllDone')}</p>
      </Sheet>
    </Page>
  );
}
