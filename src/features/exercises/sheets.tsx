import { useEffect, useState } from 'react';
import type { CustomExercise } from '@shared/api.ts';
import { EQUIPMENT, MUSCLES, TRACKING, type Equipment, type Exercise, type Muscle, type Tracking } from '@shared/data/types.ts';
import type { PbKind } from '@shared/game/types.ts';
import { confirm, toast } from '@/components/glass/feedback.tsx';
import { Sheet } from '@/components/glass/dialog.tsx';
import { MuscleMap } from '@/components/MuscleMap.tsx';
import { Button, ErrorNote, Field } from '@/components/ui.tsx';
import { errorMessage, useT } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { fmtDate, fmtPb, fmtSet } from '@/lib/format.ts';
import { keys, queryClient, useGame, useLibrary } from '@/lib/queries.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { ExerciseBrowser, setFavorite } from './ExerciseBrowser.tsx';

const PB_ORDER: PbKind[] = ['weight', 'e1rm', 'reps', 'volume', 'distance', 'pace', 'duration'];

/** Exercise detail: muscle map, how-to, last performance and personal bests. */
export function ExerciseDetail({ exercise, onClose, onEdit }: { exercise: Exercise | null; onClose: () => void; onEdit?: (x: CustomExercise) => void }) {
  const { t, loc, lang } = useT();
  const units = usePrefs((s) => s.units);
  const library = useLibrary().data;
  const game = useGame().data;
  // Keep showing the last exercise while the sheet animates out.
  const [shown, setShown] = useState(exercise);
  useEffect(() => {
    if (exercise) setShown(exercise);
  }, [exercise]);
  const x = exercise ?? shown;
  if (!x) return null;
  const fav = library?.favorites.includes(x.id) ?? false;
  const last = library?.lastPerf[x.id];
  const pbs = game?.pbs[x.id];

  const remove = async () => {
    if (!(await confirm({ title: t('common.delete'), message: t('library.customDeleteConfirm', { name: loc(x.name) }), danger: true, confirmLabel: t('common.delete') }))) return;
    await api(`/exercises/${x.id}`, { method: 'DELETE' }).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: keys.library });
    onClose();
  };

  return (
    <Sheet open={!!exercise} onClose={onClose} title={loc(x.name)}>
      <p className="mb-3 text-sm text-ink-soft">
        {t(`equipment.${x.equipment}`)} · {t(`tracking.${x.tracking}`)}
      </p>
      <div className="px px-flat mb-4 p-3">
        <MuscleMap primary={x.primary} secondary={x.secondary} />
      </div>
      {loc(x.desc) && (
        <>
          <h3 className="mb-1 text-[10px]">{t('library.howTo')}</h3>
          <p className="mb-4 leading-relaxed">{loc(x.desc)}</p>
        </>
      )}
      {last && (
        <>
          <h3 className="mb-1 text-[10px]">
            {t('workout.prev')} · {fmtDate(last.at, lang)}
          </h3>
          <p className="mb-4 text-sm tabular">{last.sets.map((s) => fmtSet(x.tracking, s, units, lang, t('unit.reps'))).join('  |  ')}</p>
        </>
      )}
      {pbs && Object.keys(pbs).length > 0 && (
        <>
          <h3 className="mb-1 text-[10px]">{t('stats.pbs')}</h3>
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {PB_ORDER.filter((k) => pbs[k] != null).map((k) => (
              <div key={k} className="flex justify-between gap-2 border-b border-dashed border-line/40 py-1">
                <dt className="text-ink-soft">{t(`summary.pb.${k}`)}</dt>
                <dd className="font-bold tabular">{fmtPb(k, pbs[k]!, x.tracking, units, lang, t('unit.reps'))}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <div className="flex flex-wrap gap-1">
        <Button small icon="heart" onClick={() => void setFavorite(x.id, !fav)} aria-pressed={fav}>
          {t(fav ? 'library.favorite.remove' : 'library.favorite.add')}
        </Button>
        {x.custom && onEdit && (
          <>
            <Button small icon="pencil" onClick={() => onEdit(x as CustomExercise)}>
              {t('common.edit')}
            </Button>
            <Button small icon="trash" variant="danger" onClick={remove}>
              {t('common.delete')}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

const toggle = <V,>(list: V[], v: V) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Create or edit a private custom exercise. */
export function CustomExerciseSheet({ open, editing, onClose }: { open: boolean; editing?: CustomExercise | null; onClose: (createdId?: string) => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [primary, setPrimary] = useState<Muscle[]>([]);
  const [secondary, setSecondary] = useState<Muscle[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('other');
  const [tracking, setTracking] = useState<Tracking>('weight_reps');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name.en ?? '');
    setPrimary(editing?.primary ?? []);
    setSecondary(editing?.secondary ?? []);
    setEquipment(editing?.equipment ?? 'other');
    setTracking(editing?.tracking ?? 'weight_reps');
    setError(null);
  }, [open, editing]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), primary, secondary: secondary.filter((m) => !primary.includes(m)), equipment, tracking };
      const res = editing ? await api<{ id?: string }>(`/exercises/${editing.id}`, { method: 'PUT', body }) : await api<{ id: string }>('/exercises', { method: 'POST', body });
      await queryClient.invalidateQueries({ queryKey: keys.library });
      toast(t('settings.saved'));
      onClose(res.id ?? editing?.id);
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={() => onClose()}
      title={t(editing ? 'library.customEdit' : 'library.customNew')}
      footer={
        <Button variant="primary" block disabled={busy || !name.trim() || primary.length === 0} onClick={save}>
          {t('common.save')}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t('library.customPrivate')}</p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label={t('library.customName')}>
          <input className="px-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ChipGroup label={`${t('library.muscles')} – ${t('library.primary')}`}>
          {MUSCLES.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={primary.includes(m)} onClick={() => setPrimary(toggle(primary, m).slice(0, 6))}>
              {t(`muscle.${m}`)}
            </button>
          ))}
        </ChipGroup>
        <ChipGroup label={`${t('library.muscles')} – ${t('library.secondary')}`}>
          {MUSCLES.filter((m) => !primary.includes(m)).map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={secondary.includes(m)} onClick={() => setSecondary(toggle(secondary, m))}>
              {t(`muscle.${m}`)}
            </button>
          ))}
        </ChipGroup>
        <ChipGroup label={t('library.equipment')}>
          {EQUIPMENT.map((eq) => (
            <button key={eq} type="button" className="chip" aria-pressed={equipment === eq} onClick={() => setEquipment(eq)}>
              {t(`equipment.${eq}`)}
            </button>
          ))}
        </ChipGroup>
        {!editing && (
          <ChipGroup label={t('library.customTracking')}>
            {TRACKING.map((tr) => (
              <button key={tr} type="button" className="chip" aria-pressed={tracking === tr} onClick={() => setTracking(tr)}>
                {t(`tracking.${tr}`)}
              </button>
            ))}
          </ChipGroup>
        )}
        {primary.length > 0 && (
          <div className="px px-flat p-3">
            <MuscleMap primary={primary} secondary={secondary.filter((m) => !primary.includes(m))} hideLegend />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1 text-sm font-semibold">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Bottom-sheet picker: filter the library, select several exercises, add them in one go. */
export function ExercisePicker({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const { t, tn } = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t('library.pick')}
        tall
        footer={
          <Button variant="primary" block disabled={selected.length === 0} onClick={() => onAdd(selected)}>
            {selected.length ? tn('library.addSelected', selected.length) : t('library.pick')}
          </Button>
        }
      >
        <ExerciseBrowser selected={selected} onToggle={(id) => setSelected((s) => toggle(s, id))} onOpen={setDetail} onCreate={() => setCreating(true)} />
      </Sheet>
      <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
      <CustomExerciseSheet
        open={creating}
        onClose={(id) => {
          setCreating(false);
          if (id) setSelected((s) => (s.includes(id) ? s : [...s, id]));
        }}
      />
    </>
  );
}
