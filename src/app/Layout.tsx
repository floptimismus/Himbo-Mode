import type { ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import type { SpriteName } from '@/components/pixel/sprites.ts';
import { cx, IconButton } from '@/components/ui.tsx';
import { useT, type Key } from '@/i18n/index.ts';
import { useLive } from '@/stores/live.ts';
import { useOutbox } from '@/stores/outbox.ts';

const TABS: Array<{ to: string; icon: SpriteName; label: Key }> = [
  { to: '/', icon: 'home', label: 'nav.home' },
  { to: '/workout', icon: 'dumbbell', label: 'nav.workout' },
  { to: '/routines', icon: 'scroll', label: 'nav.routines' },
  { to: '/progress', icon: 'cup', label: 'nav.progress' },
  { to: '/profile', icon: 'person', label: 'nav.profile' },
];

const MONO = { k: 'currentColor', x: 'transparent', w: 'transparent', y: 'transparent' };

/** Floating liquid-glass tab bar. */
function TabBar() {
  const { t } = useT();
  const live = useLive((s) => !!s.active);
  return (
    <nav aria-label={t('nav.main')} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
      <ul className="glass pointer-events-auto flex w-full max-w-md items-stretch justify-between rounded-[28px] p-1.5">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[22px] px-1 text-[10px] font-semibold transition-colors',
                  isActive ? 'bg-ink/12 text-ink shadow-[inset_0_1px_0_var(--glass-hi)]' : 'text-ink/80',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <PixelSprite sprite={tab.icon} size={18} palette={tab.icon === 'cup' ? MONO : undefined} className={cx(isActive && 'text-primary')} />
                  <span className={cx(isActive && 'underline decoration-2 underline-offset-2')}>{t(tab.label)}</span>
                  {tab.to === '/workout' && live && <span className="anim-blink absolute right-3 top-1.5 h-2 w-2 bg-primary" aria-hidden="true" />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SyncBanner() {
  const { tn } = useT();
  const pending = useOutbox((s) => s.pending.length);
  if (!pending) return null;
  return (
    <div role="status" className="mx-auto mt-2 w-fit max-w-full border-2 border-line bg-gold px-3 py-1 text-center text-xs font-semibold text-gold-ink">
      {tn('sync.pending', pending)}
    </div>
  );
}

export function Layout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

interface PageProps {
  title: string;
  /** Show a back button; a string navigates there, `true` goes back in history. */
  back?: boolean | string;
  actions?: ReactNode;
  children: ReactNode;
  /** Extra content inside the glass header (e.g. the live timer). */
  headerExtra?: ReactNode;
}

/** A screen: sticky glass navigation bar on top, pixel content below. */
export function Page({ title, back, actions, children, headerExtra }: PageProps) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl">
      <header className="sticky top-0 z-30 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="glass rounded-[22px] px-2">
          <div className="flex min-h-12 items-center gap-1">
            {back ? (
              <IconButton icon="left" label={t('common.back')} size={14} onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} />
            ) : (
              <span className="w-3" />
            )}
            <h1 className="min-w-0 flex-1 truncate text-xs">{title}</h1>
            {actions}
          </div>
          {headerExtra}
        </div>
      </header>
      <SyncBanner />
      <main className="px-3 pb-36 pt-3">{children}</main>
    </div>
  );
}
