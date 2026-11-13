import { useMemo } from 'react';
import type { Lang, Localized } from '@shared/data/types.ts';
import { usePrefs } from '@/stores/prefs.ts';
import { de } from './de.ts';
import { en, type Key } from './en.ts';

export type { Key };
type Params = Record<string, string | number>;
/** Keys that exist as `.one` / `.other` pairs. */
type PluralKey = Key extends infer K ? (K extends `${infer P}.one` ? P : never) : never;

const dicts: Record<Lang, Record<Key, string>> = { en, de };

export function translate(lang: Lang, key: Key, params?: Params): string {
  let s: string = dicts[lang][key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export interface T {
  lang: Lang;
  t: (key: Key, params?: Params) => string;
  /** Plural-aware: picks `<key>.one` or `<key>.other` and fills `{n}`. */
  tn: (key: PluralKey, n: number, params?: Params) => string;
  /** Pick the current language from localized data (exercises, trophies, ranks). */
  loc: (value: Localized) => string;
}

export function makeT(lang: Lang): T {
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
    tn: (key, n, params) => translate(lang, `${key}.${n === 1 ? 'one' : 'other'}` as Key, { n, ...params }),
    loc: (value) => value[lang] || value.en,
  };
}

export function useT(): T {
  const lang = usePrefs((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}

/** Maps an API error code to a localized message. */
export function errorMessage(t: T['t'], err: unknown): string {
  const code = (err as { code?: string })?.code;
  const key = `error.${code}` as Key;
  return code && key in en ? t(key) : t('error.generic');
}
