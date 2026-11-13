import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@shared/data/types.ts';
import type { Units } from '@shared/units.ts';

export type Theme = 'light' | 'dark' | 'system';

interface Prefs {
  lang: Lang;
  theme: Theme;
  units: Units;
  restEnabled: boolean;
  restSeconds: number;
  sound: boolean;
  vibrate: boolean;
  set: (patch: Partial<Omit<Prefs, 'set'>>) => void;
}

const browserLang = (): Lang => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');

/** Device-level preferences. Language, theme and units are mirrored to the account when signed in. */
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      lang: browserLang(),
      theme: 'system',
      units: 'kg',
      restEnabled: true,
      restSeconds: 90,
      sound: true,
      vibrate: true,
      set: (patch) => set(patch),
    }),
    { name: 'himbo-prefs' },
  ),
);

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Keeps <html data-theme lang> in sync with the store and the OS setting. */
export function bindDocumentPrefs() {
  const apply = () => {
    const { theme, lang } = usePrefs.getState();
    document.documentElement.dataset.theme = resolveTheme(theme);
    document.documentElement.lang = lang;
  };
  apply();
  usePrefs.subscribe(apply);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
}
