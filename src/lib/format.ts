import type { Lang, Tracking } from '@shared/data/types.ts';
import type { GSet, PbKind } from '@shared/game/types.ts';
import { distanceUnit, fromKg, fromMetres, M_PER_MILE, type Units } from '@shared/units.ts';

const locale = (lang: Lang) => (lang === 'de' ? 'de-DE' : 'en-GB');
const pad = (n: number) => String(n).padStart(2, '0');

export function fmtNumber(n: number, lang: Lang, maxDigits = 1): string {
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: maxDigits }).format(n);
}

/** Compact numbers for big totals (12.5K, 1.2M). */
export function fmtCompact(n: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Clock style: 45:10 or 1:05:30. */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Words: "1 h 5 min", "45 min", "30 s". */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export const fmtWeight = (kg: number, units: Units, lang: Lang) => `${fmtNumber(fromKg(kg, units), lang)} ${units}`;
export const fmtDistance = (m: number, units: Units, lang: Lang) => `${fmtNumber(fromMetres(m, units), lang, 2)} ${distanceUnit(units)}`;

export function fmtPace(secPerKm: number, units: Units): string {
  const sec = units === 'lb' ? (secPerKm * M_PER_MILE) / 1000 : secPerKm;
  return `${fmtClock(sec)} /${distanceUnit(units)}`;
}

export function fmtDate(ts: number, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return new Intl.DateTimeFormat(locale(lang), opts).format(ts);
}
export const fmtDateLong = (ts: number, lang: Lang) => fmtDate(ts, lang, { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtTime = (ts: number, lang: Lang) => fmtDate(ts, lang, { hour: '2-digit', minute: '2-digit' });

/**
 * Parse a typed duration. "1:30" → 90 s, "1:05:00" → 3900 s; a plain number is read in
 * `plainUnit` (minutes for cardio, seconds for holds). Returns null for empty/invalid input.
 */
export function parseDuration(text: string, plainUnit: 'min' | 'sec'): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.some((p) => !Number.isFinite(p) || p < 0) || parts.length > 3) return null;
    return Math.round(parts.reduce((acc, p) => acc * 60 + p, 0));
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(plainUnit === 'min' ? n * 60 : n);
}

export function parseNumber(text: string): number | null {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** One-line description of a set, e.g. "60 kg × 10" or "5 km · 25:00". */
export function fmtSet(tracking: Tracking, s: GSet, units: Units, lang: Lang, repsLabel: string): string {
  switch (tracking) {
    case 'weight_reps':
      return `${fmtWeight(s.weightKg ?? 0, units, lang)} × ${s.reps ?? 0}`;
    case 'reps':
      return `${s.reps ?? 0} ${repsLabel}`;
    case 'time':
      return fmtClock(s.durationS ?? 0);
    case 'distance_time':
      return [s.distanceM ? fmtDistance(s.distanceM, units, lang) : null, s.durationS ? fmtClock(s.durationS) : null].filter(Boolean).join(' · ');
    case 'duration_rpe':
      return [fmtClock(s.durationS ?? 0), s.rpe ? `RPE ${s.rpe}` : null].filter(Boolean).join(' · ');
  }
}

export function fmtPb(kind: PbKind, value: number, tracking: Tracking, units: Units, lang: Lang, repsLabel: string): string {
  switch (kind) {
    case 'weight':
    case 'e1rm':
      return fmtWeight(value, units, lang);
    case 'reps':
      return `${fmtNumber(value, lang)} ${repsLabel}`;
    case 'volume':
      return tracking === 'reps' ? `${fmtNumber(value, lang)} ${repsLabel}` : fmtWeight(value, units, lang);
    case 'duration':
      return fmtClock(value);
    case 'distance':
      return fmtDistance(value, units, lang);
    case 'pace':
      return fmtPace(value, units);
  }
}
