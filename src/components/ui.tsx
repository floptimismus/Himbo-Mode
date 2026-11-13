import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { PixelSprite } from './pixel/PixelSprite.tsx';
import type { SpriteName } from './pixel/sprites.ts';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');
export { cx };

/** Pixel-bordered content card. `dialog` adds the RPG text-box inner line. */
export function Card({ children, className, dialog, as: Tag = 'div' }: { children: ReactNode; className?: string; dialog?: boolean; as?: 'div' | 'section' | 'li' | 'article' }) {
  return <Tag className={cx('px p-4', dialog && 'px-dialog', className)}>{children}</Tag>;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'accent' | 'gold' | 'danger';
  small?: boolean;
  icon?: SpriteName;
  block?: boolean;
}

export function Button({ variant = 'default', small, icon, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx('px-btn', variant !== 'default' && variant, small && 'small', block && 'w-[calc(100%-6px)]', className)} {...rest}>
      {icon && <PixelSprite sprite={icon} size={small ? 12 : 14} />}
      {children}
    </button>
  );
}

/** Square icon-only button with a 44px tap target. */
export function IconButton({ icon, label, className, size = 16, palette, ...rest }: { icon: SpriteName; label: string; size?: number; palette?: Record<string, string> } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink disabled:opacity-40', className)} {...rest}>
      <PixelSprite sprite={icon} size={size} palette={palette} />
    </button>
  );
}

/** Blocky HP/XP-style bar. */
export function Bar({ value, color, label, className }: { value: number; color?: string; label: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={cx('px-bar', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <i style={{ width: `${pct}%`, ['--bar' as string]: color }} />
    </div>
  );
}

export function Segmented<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: Array<{ value: V; label: string }>; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex gap-2 overflow-x-auto p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className="chip flex-1 justify-center" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Switch with a text state so it never relies on color alone. */
export function Toggle({ checked, onChange, label, hint, onText, offText }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; onText: string; offText: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-ink-soft">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx('flex h-8 w-16 items-center border-[3px] border-line px-1 font-pixel text-[8px] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]', checked ? 'justify-start bg-good text-white' : 'justify-end bg-surface-2 text-ink-soft')}>
          {checked ? onText : offText}
        </span>
        <span className={cx('pointer-events-none absolute top-1 h-6 w-5 bg-ink transition-[left] duration-150 [transition-timing-function:steps(3)]', checked ? 'left-[38px]' : 'left-1')} />
      </span>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-2 px-1">
      <h2 className="text-[11px] uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cx('px px-thin px-flat p-2 text-center', className)}>
      <div className="font-pixel text-[11px] leading-5 tabular">{value}</div>
      <div className="text-xs text-ink-soft">{label}</div>
    </div>
  );
}

export function Empty({ icon = 'star', children }: { icon?: SpriteName; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-ink-soft">
      <PixelSprite sprite={icon} size={36} className="anim-bob opacity-70" palette={{ k: 'currentColor', x: 'transparent', w: 'transparent', y: 'transparent' }} />
      <p>{children}</p>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-10" role="status" aria-label={label}>
      <span className="font-pixel text-xs anim-blink">▮▮▮</span>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="my-2 border-[3px] border-bad bg-surface p-3 text-sm font-semibold">
      <span aria-hidden="true">⚠ </span>
      {children}
    </p>
  );
}
