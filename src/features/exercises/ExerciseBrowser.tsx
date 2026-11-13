import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { EQUIPMENT, MUSCLES, type Exercise } from '@shared/data/types.ts';
import { PixelSprite } from '@/components/pixel/PixelSprite.tsx';
import { Button, cx, Empty, IconButton, Segmented } from '@/components/ui.tsx';
import { useT, type Key } from '@/i18n/index.ts';
import { api } from '@/lib/api.ts';
import { keys, queryClient, useExercises, useLibrary } from '@/lib/queries.ts';
import type { LibraryState } from '@shared/api.ts';
import { EMPTY_FILTER, filterExercises, type LibraryFilter, type LibrarySort, type LibraryTab } from './filter.ts';

const toggle = <V,>(list: V[], v: V) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export async function setFavorite(id: string, favorite: boolean) {
  // Optimistic: flip locally, then tell the server.
  queryClient.setQueryData<LibraryState>(keys.library, (old) => old && { ...old, favorites: favorite ? [...old.favorites, id] : old.favorites.filter((x) => x !== id) });
  await api(`/exercises/${encodeURIComponent(id)}/favorite`, { method: 'PUT', body: { favorite } }).catch(() => undefined);
  void queryClient.invalidateQueries({ queryKey: keys.library });
}

interface Props {
  /** Pick mode: rows toggle selection. Browse mode: rows open the detail. */
  selected?: string[];
  onToggle?: (id: string) => void;
  onOpen: (exercise: Exercise) => void;
  onCreate: () => void;
}

/** Search, filter chips, tabs and the result list. Shared by the library page and the picker sheet. */
export function ExerciseBrowser({ selected, onToggle, onOpen, onCreate }: Props) {
  const { t, tn, lang, loc } = useT();
  const { all } = useExercises();
  const library = useLibrary().data;
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);
  const listRef = useRef<HTMLUListElement>(null);
  const favorites = useMemo(() => library?.favorites ?? [], [library?.favorites]);
  const picking = !!onToggle;

  const results = useMemo(
    () => filterExercises(all, filter, { lang, favorites, recents: library?.recents ?? [], label: (kind, id) => (id ? t(`${kind}.${id}` as Key) : '') }),
    [all, filter, lang, favorites, library?.recents, t],
  );
  const active = filter.muscles.length + filter.equipment.length + (filter.query ? 1 : 0);

  // Arrow keys move through the result rows; Enter/Space activate the focused row.
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    rows[next]?.focus();
    e.preventDefault();
  };

  return (
    <div>
      <div className="relative">
        <PixelSprite sprite="search" size={16} className="pointer-events-none absolute left-3 top-3.5 text-ink-soft" />
        <input
          type="search"
          className="px-input !pl-10"
          placeholder={t('library.search')}
          aria-label={t('library.search')}
          value={filter.query}
          onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              listRef.current?.querySelector<HTMLElement>('[data-row]')?.focus();
              e.preventDefault();
            }
          }}
        />
      </div>

      <div className="mt-2">
        <Segmented<LibraryTab>
          label={t('library.title')}
          value={filter.tab}
          onChange={(tab) => setFilter({ ...filter, tab })}
          options={(['all', 'recent', 'favorites', 'custom'] as const).map((v) => ({ value: v, label: t(`library.tab.${v}`) }))}
        />
      </div>

      <ChipRow label={t('library.muscles')}>
        {MUSCLES.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={filter.muscles.includes(m)} onClick={() => setFilter({ ...filter, muscles: toggle(filter.muscles, m) })}>
            {t(`muscle.${m}`)}
          </button>
        ))}
      </ChipRow>
      <ChipRow label={t('library.equipment')}>
        {EQUIPMENT.map((eq) => (
          <button key={eq} type="button" className="chip" aria-pressed={filter.equipment.includes(eq)} onClick={() => setFilter({ ...filter, equipment: toggle(filter.equipment, eq) })}>
            {t(`equipment.${eq}`)}
          </button>
        ))}
      </ChipRow>

      <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm">
        <span role="status" className="font-semibold tabular">
          {tn('library.results', results.length)}
        </span>
        <span className="flex items-center gap-2">
          {active > 0 && (
            <button type="button" className="min-h-9 underline" onClick={() => setFilter({ ...EMPTY_FILTER, tab: filter.tab, sort: filter.sort })}>
              {t('library.clear')}
            </button>
          )}
          <label className="flex items-center gap-1">
            <span className="sr-only">{t('library.sort')}</span>
            <select className="min-h-9 border-2 border-line bg-surface px-1 text-sm font-semibold" value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as LibrarySort })}>
              {(['name', 'muscle', 'equipment'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`library.sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </span>
      </div>

      {results.length === 0 ? (
        <Empty icon="search">{t('library.empty')}</Empty>
      ) : (
        <ul ref={listRef} className="mt-2 space-y-1.5" onKeyDown={onListKey}>
          {results.map((x) => {
            const isSel = selected?.includes(x.id) ?? false;
            const fav = favorites.includes(x.id);
            return (
              <li key={x.id} className={cx('flex items-stretch border-2 border-line bg-surface', isSel && 'bg-surface-2 outline-3 outline-[var(--primary)]')}>
                <button
                  type="button"
                  data-row
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 px-3 py-1.5 text-left"
                  aria-pressed={picking ? isSel : undefined}
                  aria-label={picking ? t('library.select', { name: loc(x.name) }) : undefined}
                  onClick={() => (picking ? onToggle(x.id) : onOpen(x))}
                >
                  {picking && (
                    <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center border-2 border-line', isSel ? 'bg-primary text-primary-ink' : 'bg-surface text-transparent')} aria-hidden="true">
                      <PixelSprite sprite="check" size={10} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {loc(x.name)}
                      {x.custom && <span className="ml-2 border border-line px-1 text-[10px] font-bold uppercase">{t('library.customBadge')}</span>}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {t(`equipment.${x.equipment}`)} · {x.primary.map((m) => t(`muscle.${m}`)).join(', ')}
                    </span>
                  </span>
                </button>
                {picking && <IconButton icon="search" label={`${loc(x.name)}: ${t('workout.info')}`} size={14} onClick={() => onOpen(x)} />}
                <IconButton
                  icon="heart"
                  size={16}
                  label={`${loc(x.name)}: ${t(fav ? 'library.favorite.remove' : 'library.favorite.add')}`}
                  aria-pressed={fav}
                  palette={fav ? { k: 'var(--line)', x: 'var(--primary)', w: '#fff' } : { k: 'var(--ink-soft)', x: 'transparent', w: 'transparent' }}
                  onClick={() => void setFavorite(x.id, !fav)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Button block className="mt-4" icon="plus" onClick={onCreate}>
        {t('library.customNew')}
      </Button>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mt-2">
      <div className="px-1 text-xs font-semibold text-ink-soft">{label}</div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">{children}</div>
    </div>
  );
}
