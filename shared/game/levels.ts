import type { Localized } from '../data/types.ts';
import { LEVEL_BASE, LEVEL_EXP, MAX_LEVEL } from './constants.ts';

/** Total XP required to reach `level` (level 1 = 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const l = Math.min(level, MAX_LEVEL);
  return Math.round((LEVEL_BASE * Math.pow(l - 1, LEVEL_EXP)) / 10) * 10;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP span of the current level (0 at max level). */
  needed: number;
  /** 0..1 */
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, ratio: 1 };
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const current = xp - floor;
  return { level, current, needed, ratio: Math.min(1, current / needed) };
}

export interface Rank {
  id: string;
  minLevel: number;
  name: Localized;
}

/** Class-like titles, ordered by the level at which they unlock. */
export const RANKS: readonly Rank[] = [
  { id: 'couch', minLevel: 1, name: { en: 'Couch Potato', de: 'Sofakartoffel' } },
  { id: 'tourist', minLevel: 3, name: { en: 'Gym Tourist', de: 'Studio-Tourist' } },
  { id: 'padawan', minLevel: 5, name: { en: 'Protein Padawan', de: 'Protein-Padawan' } },
  { id: 'rookie', minLevel: 8, name: { en: 'Rep Rookie', de: 'Satz-Frischling' } },
  { id: 'apprentice', minLevel: 12, name: { en: 'Pump Apprentice', de: 'Pump-Lehrling' } },
  { id: 'buddy', minLevel: 16, name: { en: 'Iron Buddy', de: 'Eisenkumpel' } },
  { id: 'scout', minLevel: 20, name: { en: 'Swole Scout', de: 'Muckie-Pfadfinder' } },
  { id: 'goblin', minLevel: 25, name: { en: 'Gains Goblin', de: 'Gains-Kobold' } },
  { id: 'beefcake', minLevel: 30, name: { en: 'Beefcake', de: 'Kraftpaket' } },
  { id: 'certified', minLevel: 36, name: { en: 'Certified Himbo', de: 'Geprüfter Himbo' } },
  { id: 'scrum', minLevel: 42, name: { en: 'Scrum Machine', de: 'Gedränge-Maschine' } },
  { id: 'knight', minLevel: 50, name: { en: 'Himbo Knight', de: 'Himbo-Ritter' } },
  { id: 'demigod', minLevel: 60, name: { en: 'Demigod of Gains', de: 'Halbgott der Gains' } },
  { id: 'titan', minLevel: 70, name: { en: 'Titan of the Rack', de: 'Titan des Racks' } },
  { id: 'overlord', minLevel: 80, name: { en: 'Himbo Overlord', de: 'Himbo-Overlord' } },
  { id: 'legend', minLevel: 90, name: { en: 'Himbo Legend', de: 'Himbo-Legende' } },
];

export function rankForLevel(level: number): Rank {
  let rank = RANKS[0]!;
  for (const r of RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}

export function rankIndex(level: number): number {
  return RANKS.indexOf(rankForLevel(level));
}
