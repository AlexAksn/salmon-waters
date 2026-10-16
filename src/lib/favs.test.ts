import { describe, expect, it } from 'vitest';
import { favKey, parseFavs, splitFav, toggleIn } from './favs';

describe('favourites', () => {
  it('parses stored keys and drops garbage', () => {
    expect(parseFavs(null)).toEqual([]);
    expect(parseFavs('nope')).toEqual([]);
    expect(parseFavs('{"a":1}')).toEqual([]);
    expect(parseFavs('["r2:chilliwack", 3, "bad", "r2:chilliwack", "r1:campbell"]')).toEqual(['r2:chilliwack', 'r1:campbell']);
  });
  it('toggles and keeps order', () => {
    const a = toggleIn([], 'r2:a');
    const b = toggleIn(a, 'r1:b');
    expect(b).toEqual(['r2:a', 'r1:b']);
    expect(toggleIn(b, 'r2:a')).toEqual(['r1:b']);
  });
  it('keys round-trip', () => {
    expect(splitFav(favKey('r2', 'lcr:mouth'))).toEqual(['r2', 'lcr:mouth']);
  });
});
