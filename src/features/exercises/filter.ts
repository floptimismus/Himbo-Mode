import type { Equipment, Exercise, Lang, Muscle } from '@shared/data/types.ts';

export type LibraryTab = 'all' | 'recent' | 'favorites' | 'custom';
export type LibrarySort = 'name' | 'muscle' | 'equipment';

export interface LibraryFilter {
  query: string;
  muscles: Muscle[];
  equipment: Equipment[];
  tab: LibraryTab;
  sort: LibrarySort;
}

export const EMPTY_FILTER: LibraryFilter = { query: '', muscles: [], equipment: [], tab: 'all', sort: 'name' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Filter + sort the library. Muscle and equipment chips are OR within a group and AND across
 * groups; the text search matches every typed word against the name in the current language.
 */
export function filterExercises(
  all: Exercise[],
  f: LibraryFilter,
  ctx: { lang: Lang; favorites: string[]; recents: string[]; label: (kind: 'muscle' | 'equipment', id: string) => string },
): Exercise[] {
  const words = norm(f.query).split(/\s+/).filter(Boolean);
  let list = all.filter((x) => {
    if (f.tab === 'favorites' && !ctx.favorites.includes(x.id)) return false;
    if (f.tab === 'recent' && !ctx.recents.includes(x.id)) return false;
    if (f.tab === 'custom' && !x.custom) return false;
    if (f.muscles.length && !f.muscles.some((m) => x.primary.includes(m) || x.secondary.includes(m))) return false;
    if (f.equipment.length && !f.equipment.includes(x.equipment)) return false;
    if (words.length) {
      const hay = norm(`${x.name[ctx.lang]} ${x.name.en}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const byName = (a: Exercise, b: Exercise) => a.name[ctx.lang].localeCompare(b.name[ctx.lang], ctx.lang);
  if (f.tab === 'recent') {
    list = list.sort((a, b) => ctx.recents.indexOf(a.id) - ctx.recents.indexOf(b.id));
  } else if (f.sort === 'muscle') {
    const key = (x: Exercise) => ctx.label('muscle', x.primary[0] ?? '');
    list = list.sort((a, b) => key(a).localeCompare(key(b), ctx.lang) || byName(a, b));
  } else if (f.sort === 'equipment') {
    const key = (x: Exercise) => ctx.label('equipment', x.equipment);
    list = list.sort((a, b) => key(a).localeCompare(key(b), ctx.lang) || byName(a, b));
  } else {
    // With muscle chips active, exercises that hit them as primary muscles come first.
    const primaryHit = (x: Exercise) => (f.muscles.some((m) => x.primary.includes(m)) ? 0 : 1);
    list = list.sort((a, b) => (f.muscles.length ? primaryHit(a) - primaryHit(b) : 0) || byName(a, b));
  }
  return list;
}
