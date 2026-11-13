import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Routine, RoutineExercise } from '@shared/api.ts';
import { LIMITS } from '@shared/game/constants.ts';
import { fromKg, toKg } from '@shared/units.ts';
import { Page } from '@/app/Layout.tsx';
import { confirm, toast } from '@/components/glass/feedback.tsx';
import { Button, Card, Empty, ErrorNote, Field, IconButton, Loading } from '@/components/ui.tsx';
import { errorMessage, useT } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { keys, queryClient, useExercises, useRoutines } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { ExercisePicker } from '../exercises/sheets.tsx';
import { NumField } from '../workout/fields.tsx';
import { useStartWorkout } from '../workout/WorkoutPage.tsx';
import { RoutineCard } from './RoutineCard.tsx';

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: keys.routines });
  void queryClient.invalidateQueries({ queryKey: keys.game });
};

export function RoutinesPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const start = useStartWorkout();
  const { data, isLoading } = useRoutines();
  const routines = data ?? [];

  const move = async (i: number, dir: -1 | 1) => {
    const next = [...routines];
    const j = i + dir;
    [next[i], next[j]] = [next[j]!, next[i]!];
    queryClient.setQueryData<Routine[]>(keys.routines, next);
    await api('/routines/order', { method: 'PUT', body: { ids: next.map((r) => r.id) } }).catch(() => undefined);
    refresh();
  };
  const duplicate = async (r: Routine) => {
    try {
      await api(`/routines/${r.id}/duplicate`, { method: 'POST', body: { name: t('routines.copyName', { name: r.name }).slice(0, LIMITS.nameLength) } });
      refresh();
    } catch (e) {
      toast(errorMessage(t, e), 'close');
    }
  };
  const remove = async (r: Routine) => {
    if (!(await confirm({ title: t('common.delete'), message: t('routines.deleteConfirm', { name: r.name }), danger: true, confirmLabel: t('common.delete') }))) return;
    queryClient.setQueryData<Routine[]>(keys.routines, routines.filter((x) => x.id !== r.id));
    await api(`/routines/${r.id}`, { method: 'DELETE' }).catch(() => undefined);
    refresh();
  };

  return (
    <Page title={t('routines.title')} actions={<IconButton icon="plus" label={t('routines.new')} onClick={() => navigate('/routines/new')} />}>
      {isLoading && !data && <Loading label={t('common.loading')} />}
      {data && routines.length === 0 && <Empty icon="scroll">{t('routines.empty')}</Empty>}
      <ul className="space-y-3">
        {routines.map((r, i) => (
          <RoutineCard key={r.id} routine={r} onStart={() => start(r)}>
            <div className="mt-2 flex flex-wrap items-center gap-0.5 border-t border-dashed border-line/40 pt-1">
              <IconButton icon="up" size={10} label={`${r.name}: ${t('workout.moveUp')}`} disabled={i === 0} onClick={() => void move(i, -1)} />
              <IconButton icon="down" size={10} label={`${r.name}: ${t('workout.moveDown')}`} disabled={i === routines.length - 1} onClick={() => void move(i, 1)} />
              <span className="flex-1" />
              <IconButton icon="pencil" size={14} label={`${r.name}: ${t('common.edit')}`} onClick={() => navigate(`/routines/${r.id}`)} />
              <IconButton icon="copy" size={14} label={`${r.name}: ${t('routines.duplicate')}`} onClick={() => void duplicate(r)} />
              <IconButton icon="trash" size={14} label={`${r.name}: ${t('common.delete')}`} onClick={() => void remove(r)} />
            </div>
          </RoutineCard>
        ))}
      </ul>
      {routines.length > 0 && (
        <Button block className="mt-4" icon="plus" onClick={() => navigate('/routines/new')}>
          {t('routines.new')}
        </Button>
      )}
    </Page>
  );
}

/** Create (`/routines/new`) or edit (`/routines/:id`) a routine with target sets/reps/weight. */
export function RoutineEditPage() {
  const { t, loc } = useT();
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const units = usePrefs((s) => s.units);
  const { byId } = useExercises();
  const { data: routines } = useRoutines();
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineExercise[] | null>(isNew ? [] : null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || items !== null) return;
    const r = routines?.find((x) => x.id === id);
    if (r) {
      setName(r.name);
      setItems(r.exercises);
    }
  }, [isNew, items, routines, id]);

  const patch = (i: number, p: Partial<RoutineExercise>) => setItems((prev) => prev!.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const next = [...prev!];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = async () => {
    if (!items?.length) return setError(t('routines.needExercise'));
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), exercises: items };
      if (isNew) await api('/routines', { method: 'POST', body });
      else await api(`/routines/${id}`, { method: 'PUT', body });
      refresh();
      toast(t('settings.saved'));
      navigate('/routines', { replace: true });
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t(isNew ? 'routines.newTitle' : 'routines.editTitle')} back="/routines">
      {items === null ? (
        <Loading label={t('common.loading')} />
      ) : (
        <>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label={t('routines.name')}>
            <input className="px-input" placeholder={t('routines.namePlaceholder')} maxLength={LIMITS.nameLength} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <ul className="mt-4 space-y-3">
            {items.map((it, i) => {
              const ex = byId.get(it.exerciseId);
              const label = ex ? loc(ex.name) : it.exerciseId;
              return (
                <Card as="li" key={`${it.exerciseId}-${i}`} className="!p-3">
                  <div className="flex items-center gap-1">
                    <h3 className="min-w-0 flex-1 truncate text-[11px] leading-5">{label}</h3>
                    <IconButton icon="up" size={10} label={`${label}: ${t('workout.moveUp')}`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconButton icon="down" size={10} label={`${label}: ${t('workout.moveDown')}`} disabled={i === items.length - 1} onClick={() => move(i, 1)} />
                    <IconButton icon="trash" size={14} label={`${label}: ${t('workout.removeExercise')}`} onClick={() => setItems(items.filter((_, j) => j !== i))} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-ink-soft">
                    <label>
                      {t('routines.targetSets')}
                      <NumField integer max={LIMITS.setsPerExercise} label={`${label}: ${t('routines.targetSets')}`} value={it.targetSets} onChange={(v) => patch(i, { targetSets: Math.max(1, v ?? 1) })} />
                    </label>
                    {ex?.tracking === 'weight_reps' || ex?.tracking === 'reps' ? (
                      <label>
                        {t('routines.targetReps')}
                        <NumField integer max={LIMITS.reps} label={`${label}: ${t('routines.targetReps')}`} value={it.targetReps} onChange={(v) => patch(i, { targetReps: v || null })} />
                      </label>
                    ) : (
                      <span />
                    )}
                    {ex?.tracking === 'weight_reps' ? (
                      <label>
                        {t('routines.targetWeight')} ({units})
                        <NumField
                          label={`${label}: ${t('routines.targetWeight')}`}
                          value={it.targetWeightKg == null ? null : fromKg(it.targetWeightKg, units)}
                          onChange={(v) => patch(i, { targetWeightKg: v == null ? null : Math.min(LIMITS.weightKg, toKg(v, units)) })}
                        />
                      </label>
                    ) : (
                      <span />
                    )}
                  </div>
                </Card>
              );
            })}
          </ul>
          <Button block className="mt-4" variant="accent" icon="plus" onClick={() => setPicker(true)}>
            {t('workout.addExercise')}
          </Button>
          <Button block className="mt-2" variant="primary" disabled={busy || !name.trim()} onClick={save}>
            {t('common.save')}
          </Button>
          <ExercisePicker
            open={picker}
            onClose={() => setPicker(false)}
            onAdd={(ids) => {
              setItems((prev) => [
                ...prev!,
                ...ids.map((x) => {
                  const tracking = byId.get(x)?.tracking;
                  const strength = tracking === 'weight_reps' || tracking === 'reps';
                  return { exerciseId: x, targetSets: strength ? 3 : 1, targetReps: strength ? 10 : null, targetWeightKg: null, notes: null };
                }),
              ].slice(0, LIMITS.exercisesPerWorkout));
              setPicker(false);
            }}
          />
        </>
      )}
    </Page>
  );
}
