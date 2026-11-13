import type { ReactNode } from 'react';
import type { Routine } from '@shared/api.ts';
import { Button, Card } from '@/components/ui.tsx';
import { useT } from '@/i18n/index.ts';
import { useExercises } from '@/lib/queries.ts';

/** Routine summary with a one-tap start button; `children` holds extra actions. */
export function RoutineCard({ routine, onStart, children }: { routine: Routine; onStart: () => void; children?: ReactNode }) {
  const { t, tn, loc } = useT();
  const { byId } = useExercises();
  const names = routine.exercises.map((e) => (byId.get(e.exerciseId) ? loc(byId.get(e.exerciseId)!.name) : null)).filter(Boolean);
  return (
    <Card as="li" className="!p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[11px] leading-5">{routine.name}</h3>
          <p className="text-xs font-semibold text-ink-soft">{tn('routines.exercises', routine.exercises.length)}</p>
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{names.join(' · ')}</p>
        </div>
        <Button small variant="primary" icon="play" onClick={onStart} aria-label={`${t('routines.start')}: ${routine.name}`}>
          {t('routines.start')}
        </Button>
      </div>
      {children}
    </Card>
  );
}
