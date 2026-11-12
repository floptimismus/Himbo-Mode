import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '../../shared/game/constants.ts';
import { levelForXp, levelProgress, rankForLevel, RANKS, xpForLevel } from '../../shared/game/levels.ts';

describe('levels', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
  });
  it('needs 100 XP for level 2', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
  });
  it('has a strictly increasing curve', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
  });
  it('is the inverse of xpForLevel at every boundary', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
  });
  it('caps at the max level', () => {
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
    expect(levelProgress(10_000_000)).toMatchObject({ level: MAX_LEVEL, ratio: 1 });
  });
  it('reports progress inside a level', () => {
    const p = levelProgress(200); // level 2 spans 100..xpForLevel(3)
    expect(p.level).toBe(2);
    expect(p.current).toBe(100);
    expect(p.needed).toBe(xpForLevel(3) - 100);
    expect(p.ratio).toBeCloseTo(100 / (xpForLevel(3) - 100));
  });
  it('maps levels to ranks from Couch Potato to Himbo Legend', () => {
    expect(rankForLevel(1).id).toBe('couch');
    expect(rankForLevel(4).id).toBe('tourist');
    expect(rankForLevel(36).id).toBe('certified');
    expect(rankForLevel(99).id).toBe('legend');
    expect([...RANKS].sort((a, b) => a.minLevel - b.minLevel)).toEqual(RANKS);
  });
});
