import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Exercise } from '@shared/data/types.ts';
import { LIMITS } from '@shared/game/constants.ts';
import type { WorkoutSummary } from '@shared/game/types.ts';
import type { WorkoutInput } from '@shared/schemas.ts';
import type { SaveWorkoutResponse, WorkoutListItem } from '@shared/api.ts';
import { Page } from '@/app/Layout.tsx';
import { confirm, toast } from '@/components/glass/feedback.tsx';
import { Button, Card, Empty, ErrorNote, Field, Loading } from '@/components/ui.tsx';
import { errorMessage, useT, type T } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { fmtDate, fmtDuration, fmtWeight } from '@/lib/format.ts';
import { invalidateAfterWorkout, keys, queryClient, useExercises, useLibrary, useWorkout, useWorkouts } from '@/lib/queries.ts';
import type { LiveExercise } from '@/stores/live.ts';
import { useOutbox } from '@/stores/outbox.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { ExerciseDetail, ExercisePicker } from '../exercises/sheets.tsx';
import { ExerciseBlock, moveBlock } from './ExerciseBlock.tsx';
import { blockFor, routineFromWorkout, setsFromDetail, toExercisesInput } from './model.ts';
import { SummaryView } from './SummaryView.tsx';

function useSaveAsRoutine() {
  const { t } = useT();
  const { byId } = useExercises();
  const [saved, setSaved] = useState(false);
  const save = async (name: string, exercises: WorkoutInput['exercises']) => {
    try {
      await api('/routines', { method: 'POST', body: routineFromWorkout(name, exercises, (id) => byId.get(id)?.tracking) });
      setSaved(true);
      toast(t('summary.routineSaved'), 'scroll');
      void queryClient.invalidateQueries({ queryKey: keys.routines });
      void queryClient.invalidateQueries({ queryKey: keys.game });
    } catch (e) {
      toast(errorMessage(t, e), 'close');
    }
  };
  return { saved, save };
}

async function share(t: T['t'], name: string, durationS: number, summary: WorkoutSummary | null, sets: number) {
  const text = t('summary.shareText', { name, duration: fmtDuration(durationS), sets, xp: summary?.xp.total ?? 0, level: summary?.levelAfter ?? 1 });
  try {
    if (navigator.share) await navigator.share({ text, title: 'Himbo-Mode' });
    else {
      await navigator.clipboard.writeText(text);
      toast(t('common.copied'));
    }
  } catch {
    /* share sheet dismissed */
  }
}

/** Shown right after finishing: works from the local outbox, so it also renders offline. */
export function WorkoutDonePage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const local = useOutbox((s) => (id ? s.recent[id] : undefined));
  const remote = useWorkout(id, !local);
  const routine = useSaveAsRoutine();

  const input = local?.input;
  const data = input
    ? { name: input.name, startedAt: input.startedAt, durationS: Math.round((input.endedAt - input.startedAt) / 1000), exercises: input.exercises, summary: local.summary }
    : remote.data
      ? { name: remote.data.name, startedAt: remote.data.startedAt, durationS: remote.data.durationS, exercises: remote.data.exercises, summary: remote.data.summary }
      : null;

  return (
    <Page title={t('summary.title')}>
      {!data && (remote.isError ? <Empty icon="search">{t('summary.notFound')}</Empty> : <Loading label={t('common.loading')} />)}
      {data && (
        <SummaryView
          {...data}
          celebrate
          actions={
            <>
              <Button block icon="scroll" disabled={routine.saved || data.exercises.length === 0} onClick={() => void routine.save(data.name, data.exercises)}>
                {t(routine.saved ? 'summary.routineSaved' : 'summary.saveRoutine')}
              </Button>
              <Button block icon="share" onClick={() => void share(t, data.name, data.durationS, data.summary, data.exercises.reduce((n, e) => n + e.sets.length, 0))}>
                {t('summary.share')}
              </Button>
              <Button block variant="primary" icon="check" onClick={() => navigate('/', { replace: true })}>
                {t('common.done')}
              </Button>
            </>
          }
        />
      )}
    </Page>
  );
}

export function WorkoutRow({ w, to }: { w: WorkoutListItem; to?: string }) {
  const { t, tn, lang, loc } = useT();
  const units = usePrefs((s) => s.units);
  const { byId } = useExercises();
  const names = w.exerciseIds.map((id) => (byId.get(id) ? loc(byId.get(id)!.name) : null)).filter(Boolean);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[11px] leading-5">{w.name}</h3>
        <span className="shrink-0 font-pixel text-[9px] text-[var(--xp)]">{t('history.xp', { xp: w.xp })}</span>
      </div>
      <p className="text-xs font-semibold text-ink-soft tabular">
        {fmtDate(w.startedAt, lang)} · {fmtDuration(w.durationS)} · {w.sets} {t('summary.sets')}
        {w.volumeKg > 0 && ` · ${fmtWeight(w.volumeKg, units, lang)}`}
      </p>
      <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{names.length ? names.join(' · ') : tn('routines.exercises', 0)}</p>
    </>
  );
  return (
    <Card as="li" className="!p-0">
      {to ? (
        <Link to={to} className="block p-3">
          {body}
        </Link>
      ) : (
        <div className="p-3">{body}</div>
      )}
    </Card>
  );
}

export function HistoryPage() {
  const { t } = useT();
  const { data, isLoading } = useWorkouts();
  return (
    <Page title={t('history.title')} back="/">
      {isLoading && <Loading label={t('common.loading')} />}
      {data?.length === 0 && <Empty icon="clock">{t('history.empty')}</Empty>}
      <ul className="space-y-3">{data?.map((w) => <WorkoutRow key={w.id} w={w} to={`/history/${w.id}`} />)}</ul>
    </Page>
  );
}

export function HistoryDetailPage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useWorkout(id);
  const routine = useSaveAsRoutine();

  const remove = async () => {
    if (!(await confirm({ title: t('common.delete'), message: t('history.deleteConfirm'), danger: true, confirmLabel: t('common.delete') }))) return;
    try {
      await api(`/workouts/${id}`, { method: 'DELETE' });
      invalidateAfterWorkout();
      navigate('/history', { replace: true });
    } catch (e) {
      toast(errorMessage(t, e), 'close');
    }
  };

  return (
    <Page title={data?.name ?? t('history.title')} back="/history">
      {isLoading && <Loading label={t('common.loading')} />}
      {isError && <Empty icon="search">{t('summary.notFound')}</Empty>}
      {data && (
        <SummaryView
          name={data.name}
          startedAt={data.startedAt}
          durationS={data.durationS}
          exercises={data.exercises}
          summary={data.summary}
          actions={
            <>
              <Button block icon="scroll" disabled={routine.saved || data.exercises.length === 0} onClick={() => void routine.save(data.name, data.exercises)}>
                {t(routine.saved ? 'summary.routineSaved' : 'summary.saveRoutine')}
              </Button>
              <Button block icon="pencil" onClick={() => navigate(`/history/${id}/edit`)}>
                {t('common.edit')}
              </Button>
              <Button block variant="danger" icon="trash" onClick={remove}>
                {t('common.delete')}
              </Button>
            </>
          }
        />
      )}
    </Page>
  );
}

/** Edit a finished workout. The server recalculates XP, records, streaks and trophies afterwards. */
export function EditWorkoutPage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useWorkout(id);
  const index = useExercises();
  const library = useLibrary().data;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<LiveExercise[] | null>(null);
  const [picker, setPicker] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data && blocks === null) {
      setName(data.name);
      setNotes(data.notes ?? '');
      setBlocks(setsFromDetail(data));
    }
  }, [data, blocks]);

  const save = async () => {
    if (!blocks) return;
    setBusy(true);
    setError(null);
    try {
      await api<SaveWorkoutResponse>(`/workouts/${id}`, { method: 'PUT', body: { name: name.trim() || data!.name, notes: notes.trim() || null, exercises: toExercisesInput(blocks) } });
      invalidateAfterWorkout();
      await queryClient.invalidateQueries({ queryKey: keys.workout(id!) });
      toast(t('settings.saved'));
      navigate(`/history/${id}`, { replace: true });
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t('history.editTitle')} back={`/history/${id}`}>
      {!blocks ? (
        <Loading label={t('common.loading')} />
      ) : (
        <>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="mb-4 space-y-3">
            <Field label={t('workout.name')}>
              <input className="px-input" maxLength={LIMITS.nameLength} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('workout.notes')}>
              <textarea className="px-input" rows={2} maxLength={LIMITS.notesLength} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          {blocks.map((block, i) => {
            const ex = index.byId.get(block.exerciseId);
            return (
              <ExerciseBlock
                key={block.uid}
                live={false}
                block={block}
                exercise={ex}
                canUp={i > 0}
                canDown={i < blocks.length - 1}
                onChange={(b) => setBlocks((prev) => prev!.map((x) => (x.uid === b.uid ? b : x)))}
                onRemove={() => setBlocks((prev) => prev!.filter((x) => x.uid !== block.uid))}
                onMove={(dir) => setBlocks((prev) => moveBlock(prev!, i, dir))}
                onInfo={() => ex && setDetail(ex)}
              />
            );
          })}
          <Button block icon="plus" onClick={() => setPicker(true)}>
            {t('workout.addExercise')}
          </Button>
          <Button block variant="primary" className="mt-4" disabled={busy} onClick={save}>
            {t('common.save')}
          </Button>
          <ExercisePicker
            open={picker}
            onClose={() => setPicker(false)}
            onAdd={(ids) => {
              setBlocks((prev) => [
                ...prev!,
                ...ids.flatMap((x) => {
                  const ex = index.byId.get(x);
                  if (!ex) return [];
                  const b = blockFor(ex, library?.lastPerf[x]);
                  return [{ ...b, sets: b.sets.map((s) => ({ ...s, done: true })) }];
                }),
              ]);
              setPicker(false);
            }}
          />
          <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
        </>
      )}
    </Page>
  );
}

