import { useEffect, useState } from 'react';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { useT } from '@/i18n/index.ts';
import { fmtClock } from '@/lib/format.ts';
import { useLive } from '@/stores/live.ts';
import { usePrefs } from '@/stores/prefs.ts';

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Three square-wave blips, 8-bit style.
    [0, 0.18, 0.36].forEach((at, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.12);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* audio is optional */
  }
}

/** Floating glass pill with the rest countdown. Derived from an end timestamp, so it survives reloads. */
export function RestTimer() {
  const { t } = useT();
  const rest = useLive((s) => s.rest);
  const addRest = useLive((s) => s.addRest);
  const clearRest = useLive((s) => s.clearRest);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!rest) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const left = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!rest || left > 0) return;
    const { sound, vibrate } = usePrefs.getState();
    // Only signal a timer that just ran out, not one that expired while the app was closed.
    if (Date.now() - rest.endsAt < 3000) {
      if (vibrate) navigator.vibrate?.([200, 100, 200]);
      if (sound) beep();
    }
    clearRest();
  }, [rest, left, clearRest]);

  if (!rest || left <= 0) return null;
  const ratio = Math.max(0, Math.min(1, left / rest.total));
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
      <div className="glass glass-strong pointer-events-auto flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-[24px] py-1.5 pl-4 pr-1.5" role="timer" aria-label={t('workout.rest')}>
        <PixelSprite sprite="clock" size={20} palette={{ k: 'var(--line)', x: 'var(--gold)' }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-ink-soft">{t('workout.rest')}</span>
            <span className="font-pixel text-sm tabular">{fmtClock(left)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/15" aria-hidden="true">
            <div className="h-full bg-[var(--xp)]" style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
        <button type="button" className="min-h-11 rounded-full bg-ink/10 px-3 text-sm font-bold" onClick={() => addRest(15)}>
          {t('workout.restAdd')}
        </button>
        <button type="button" className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-bg" onClick={clearRest}>
          {t('workout.restSkip')}
        </button>
      </div>
    </div>
  );
}
