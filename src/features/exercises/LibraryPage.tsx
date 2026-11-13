import { useState } from 'react';
import type { CustomExercise } from '@shared/api.ts';
import type { Exercise } from '@shared/data/types.ts';
import { Page } from '@/app/Layout.tsx';
import { useT } from '@/i18n/index.ts';
import { ExerciseBrowser } from './ExerciseBrowser.tsx';
import { CustomExerciseSheet, ExerciseDetail } from './sheets.tsx';

export function LibraryPage() {
  const { t } = useT();
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [form, setForm] = useState<{ open: boolean; editing: CustomExercise | null }>({ open: false, editing: null });
  return (
    <Page title={t('library.title')} back="/">
      <ExerciseBrowser onOpen={setDetail} onCreate={() => setForm({ open: true, editing: null })} />
      <ExerciseDetail
        exercise={detail}
        onClose={() => setDetail(null)}
        onEdit={(x) => {
          setDetail(null);
          setForm({ open: true, editing: x });
        }}
      />
      <CustomExerciseSheet open={form.open} editing={form.editing} onClose={() => setForm({ open: false, editing: null })} />
    </Page>
  );
}
