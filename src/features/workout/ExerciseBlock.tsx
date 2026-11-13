import { useState } from 'react';
import type { LastPerformance } from '@shared/api.ts';
import type { Exercise } from '@shared/data/types.ts';
import { LIMITS } from '@shared/game/constants.ts';
import { SET_TYPES, type SetType } from '@shared/game/types.ts';
import { distanceUnit, fromKg, fromMetres, toKg, toMetres } from '@shared/units.ts';
import { toast } from '@/components/glass/feedback.tsx';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { Button, Card, cx, IconButton } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';
import { fmtSet } from '@/lib/format.ts';
import type { LiveExercise, LiveSet } from '@/stores/live.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { DurationField, NumField } from './fields.tsx';
import { newSet, setIsValid } from './model.ts';

const TYPE_SHORT: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };
const TYPE_STYLE: Record<SetType, string> = {
  normal: 'bg-surface-2 text-ink',
  warmup: 'bg-gold text-gold-ink',
  drop: 'bg-accent text-accent-ink',
  failure: 'bg-primary text-primary-ink',
};

interface Props {
  block: LiveExercise;
  exercise: Exercise | undefined;
  last?: LastPerformance;
  onChange: (block: LiveExercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
  onInfo: () => void;
  /** Live mode: sets have a "done" checkbox. Edit mode: every set counts. */
  live: boolean;
  onSetDone?: () => void;
}

/** One exercise in a workout: header, notes and the set table. Used by the live workout and the history editor. */
export function ExerciseBlock({ block, exercise, last, onChange, onRemove, onMove, canUp, canDown, onInfo, live, onSetDone }: Props) {
  const { t, loc, lang } = useT();
  const units = usePrefs((s) => s.units);
  const [shake, setShake] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const tracking = exercise?.tracking ?? 'weight_reps';
  const name = exercise ? loc(exercise.name) : block.exerciseId;

  const patch = (uid: string, p: Partial<LiveSet>) => onChange({ ...block, sets: block.sets.map((s) => (s.uid === uid ? { ...s, ...p } : s)) });
  const cycleType = (s: LiveSet) => patch(s.uid, { type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length]! });
  const addSet = () => {
    const prev = block.sets.at(-1);
    onChange({ ...block, sets: [...block.sets, newSet(prev ? { ...prev, done: !live } : { done: !live })] });
  };
  const toggleDone = (s: LiveSet) => {
    if (!s.done && !setIsValid(tracking, s)) {
      setShake(s.uid);
      setTimeout(() => setShake(null), 500);
      toast(t('workout.fillFirst'), 'pencil');
      return;
    }
    patch(s.uid, { done: !s.done });
    if (!s.done) onSetDone?.();
  };

  const columns: Array<{ key: string; label: string }> =
    tracking === 'weight_reps'
      ? [{ key: 'w', label: `${t('workout.weight')} (${units})` }, { key: 'r', label: t('workout.reps') }]
      : tracking === 'reps'
        ? [{ key: 'r', label: t('workout.reps') }]
        : tracking === 'time'
          ? [{ key: 't', label: t('workout.time') }]
          : tracking === 'distance_time'
            ? [{ key: 'd', label: `${t('workout.distance')} (${distanceUnit(units)})` }, { key: 't', label: t('workout.time') }]
            : [{ key: 't', label: t('workout.time') }, { key: 'e', label: 'RPE' }];
  const grid = cx('grid items-center gap-1.5', columns.length === 2 ? 'grid-cols-[40px_1fr_1fr_44px_32px]' : 'grid-cols-[40px_1fr_44px_32px]', !live && (columns.length === 2 ? '!grid-cols-[40px_1fr_1fr_32px]' : '!grid-cols-[40px_1fr_32px]'));
  const plainUnit = tracking === 'time' ? 'sec' : 'min';

  return (
    <Card as="section" className="mb-4 !p-3">
      <div className="flex items-start gap-1">
        <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={onInfo} aria-label={`${name}: ${t('workout.info')}`}>
          <h3 className="text-[11px] leading-5">{name}</h3>
          {exercise && <span className="text-xs text-ink-soft">{t(`equipment.${exercise.equipment}`)}</span>}
        </button>
        <IconButton icon="dots" label={`${name}: ${t('common.edit')}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} size={16} />
      </div>
      {menu && (
        <div className="mb-2 flex flex-wrap gap-1">
          <Button small icon="up" disabled={!canUp} onClick={() => onMove(-1)}>
            {t('workout.moveUp')}
          </Button>
          <Button small icon="down" disabled={!canDown} onClick={() => onMove(1)}>
            {t('workout.moveDown')}
          </Button>
          <Button small icon="trash" variant="danger" onClick={onRemove}>
            {t('workout.removeExercise')}
          </Button>
        </div>
      )}
      <input className="px-input mb-2 !min-h-9 !border-2 !py-1 text-sm" placeholder={t('workout.notes')} aria-label={`${t('workout.notes')}: ${name}`} maxLength={LIMITS.notesLength} value={block.notes} onChange={(e) => onChange({ ...block, notes: e.target.value })} />

      <div className={cx(grid, 'mb-1 text-center text-[11px] font-semibold text-ink-soft')} aria-hidden="true">
        <span>{t('workout.set')}</span>
        {columns.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
        {live && <span>✓</span>}
        <span />
      </div>

      <ul className="space-y-1.5">
        {block.sets.map((s, i) => {
          const n = i + 1;
          const prev = last?.sets[i];
          return (
            <li key={s.uid} className={cx('p-1', s.done && live && 'bg-good/15', shake === s.uid && 'anim-shake')}>
              <div className={grid}>
                <button type="button" className={cx('h-10 border-2 border-line font-pixel text-[10px]', TYPE_STYLE[s.type])} onClick={() => cycleType(s)} aria-label={t('workout.typeChange', { n, type: t(`workout.type.${s.type}`) })}>
                  {TYPE_SHORT[s.type] || n}
                </button>
                {columns.map((c) => {
                  const label = `${c.label}, ${t('workout.set')} ${n}`;
                  if (c.key === 'w') return <NumField key="w" label={label} value={s.weightKg == null ? null : fromKg(s.weightKg, units)} onChange={(v) => patch(s.uid, { weightKg: v == null ? null : Math.min(LIMITS.weightKg, toKg(v, units)) })} />;
                  if (c.key === 'r') return <NumField key="r" label={label} integer max={LIMITS.reps} value={s.reps} onChange={(v) => patch(s.uid, { reps: v })} />;
                  if (c.key === 'd') return <NumField key="d" label={label} value={s.distanceM == null ? null : fromMetres(s.distanceM, units)} onChange={(v) => patch(s.uid, { distanceM: v == null ? null : Math.min(LIMITS.distanceM, toMetres(v, units)) })} />;
                  if (c.key === 't') return <DurationField key="t" label={label} plainUnit={plainUnit} placeholder={plainUnit === 'min' ? t('unit.min') : t('unit.sec')} value={s.durationS} onChange={(v) => patch(s.uid, { durationS: v == null ? null : Math.min(LIMITS.setDurationS, v) })} />;
                  return <NumField key="e" label={`${t('workout.rpe')}, ${t('workout.set')} ${n}`} integer max={10} placeholder="1–10" value={s.rpe} onChange={(v) => patch(s.uid, { rpe: v == null || v < 1 ? null : v })} />;
                })}
                {live && (
                  <button type="button" className={cx('flex h-11 w-11 items-center justify-center border-[3px] border-line', s.done ? 'bg-good text-bg' : 'bg-surface text-transparent')} aria-pressed={s.done} aria-label={t('workout.markDone', { n })} onClick={() => toggleDone(s)}>
                    <PixelSprite sprite="check" size={14} className={cx(s.done && 'anim-pop')} />
                  </button>
                )}
                <button type="button" className="flex h-11 w-8 items-center justify-center text-ink-soft" aria-label={t('workout.removeSet', { n })} onClick={() => onChange({ ...block, sets: block.sets.filter((x) => x.uid !== s.uid) })}>
                  <PixelSprite sprite="close" size={10} />
                </button>
              </div>
              {live && (
                <p className="mt-0.5 pl-[46px] text-xs text-ink-soft tabular">
                  {s.type !== 'normal' && <span className="font-semibold">{t(`workout.type.${s.type}`)} · </span>}
                  {prev ? `${t('workout.prev')}: ${fmtSet(tracking, prev, units, lang, t('unit.reps'))}` : s.type === 'normal' ? ' ' : ''}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {(tracking === 'time' || tracking === 'distance_time' || tracking === 'duration_rpe') && (
        <p className="mt-1 text-xs text-ink-soft">{t(plainUnit === 'min' ? 'workout.timeHintMin' : 'workout.timeHintSec')}</p>
      )}
      <Button small block className="mt-2" icon="plus" disabled={block.sets.length >= LIMITS.setsPerExercise} onClick={addSet}>
        {t('workout.addSet')}
      </Button>
    </Card>
  );
}

/** Helpers for a list of exercise blocks (shared by live workout and editor). */
export function moveBlock(list: LiveExercise[], index: number, dir: -1 | 1): LiveExercise[] {
  const j = index + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[index], next[j]] = [next[j]!, next[index]!];
  return next;
}
