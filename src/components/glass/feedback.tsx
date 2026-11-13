import { create } from 'zustand';
import { useT } from '@/i18n/index.ts';
import { PixelSprite } from '../pixel/PixelSprite.tsx';
import type { SpriteName } from '../pixel/sprites.ts';
import { Button } from '../ui.tsx';
import { Modal } from './dialog.tsx';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ToastItem {
  id: number;
  text: string;
  icon: SpriteName;
}

interface FeedbackState {
  dialog: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  toasts: ToastItem[];
}

const useFeedback = create<FeedbackState>(() => ({ dialog: null, toasts: [] }));
let nextToast = 1;

/** Promise-based confirmation dialog: `if (await confirm({ title })) …`. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useFeedback.setState({ dialog: { ...options, resolve } }));
}

export function toast(text: string, icon: SpriteName = 'check') {
  const id = nextToast++;
  useFeedback.setState((s) => ({ toasts: [...s.toasts, { id, text, icon }] }));
  setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
}

/** Mounted once at the app root. */
export function FeedbackHost() {
  const { t } = useT();
  const dialog = useFeedback((s) => s.dialog);
  const toasts = useFeedback((s) => s.toasts);
  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    useFeedback.setState({ dialog: null });
  };
  return (
    <>
      <Modal open={!!dialog} onClose={() => close(false)} title={dialog?.title ?? ''}>
        {dialog?.message && <p className="mb-4 text-sm">{dialog.message}</p>}
        <div className="flex gap-2">
          <Button block onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button block variant={dialog?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {dialog?.confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </Modal>
      <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((x) => (
          <div key={x.id} className="glass glass-strong pop flex max-w-sm items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold" data-open="true">
            <PixelSprite sprite={x.icon} size={16} palette={{ k: 'var(--line)', x: 'var(--gold)', w: '#fff', y: 'var(--primary)' }} />
            {x.text}
          </div>
        ))}
      </div>
    </>
  );
}
