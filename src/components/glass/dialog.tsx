import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/index.ts';
import { cx, IconButton } from '../ui.tsx';

/** Mount → animate in; animate out → unmount. */
function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted, shown };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Escape to close, focus trap, focus restore and background scroll lock. */
function useDialogBehaviour(ref: RefObject<HTMLDivElement | null>, active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0]!;
        const last = items.at(-1)!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [active, ref]);
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Use most of the screen height (pickers). */
  tall?: boolean;
}

/** Liquid-glass bottom sheet with a spring transition. */
export function Sheet({ open, onClose, title, children, footer, tall }: SheetProps) {
  const { t } = useT();
  const { mounted, shown } = usePresence(open, 320);
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehaviour(ref, mounted && open, onClose);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="backdrop absolute inset-0 bg-[var(--scrim)]" data-open={shown} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-open={shown}
        className={cx('sheet glass glass-strong relative flex w-full max-w-xl flex-col rounded-t-[28px] outline-none', tall ? 'h-[92dvh]' : 'max-h-[92dvh]')}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-ink/25" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-2 py-1 pl-5 pr-2">
          <h2 className="text-xs">{title}</h2>
          <IconButton icon="close" label={t('common.close')} onClick={onClose} size={14} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-[var(--glass-border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}

/** Centered glass popover for confirmations and celebrations. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { mounted, shown } = usePresence(open, 180);
  const ref = useRef<HTMLDivElement>(null);
  useDialogBehaviour(ref, mounted && open, onClose);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <div className="backdrop absolute inset-0 bg-[var(--scrim)]" data-open={shown} onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1} data-open={shown} className="pop glass glass-strong relative w-full max-w-sm rounded-[26px] p-5 outline-none">
        <h2 className="mb-3 text-xs">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}
