import { useSyncExternalStore } from 'react';

// "My rivers": starred waters, kept on the device (localStorage) as "<region>:<water>" keys in the order they were starred.
// Not in the URL: it is the reader's list, not part of a shareable view.
const KEY = 'sw-favs';
export const favKey = (region: string, water: string) => `${region}:${water}`;
export const splitFav = (key: string): [region: string, water: string] => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };
export function parseFavs(raw: string | null): string[] {
  try { const a: unknown = JSON.parse(raw || '[]'); return Array.isArray(a) ? [...new Set(a.filter((s): s is string => typeof s === 'string' && s.includes(':')))] : []; } catch { return []; }
}
export const toggleIn = (list: readonly string[], key: string): string[] => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

const read = () => { try { return parseFavs(localStorage.getItem(KEY)); } catch { return []; } };
let favs: readonly string[] = typeof localStorage === 'undefined' ? [] : read();
const listeners = new Set<() => void>();
function set(next: readonly string[]) {
  favs = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: the list lives for this page only */ }
  listeners.forEach((l) => l());
}
export const toggleFav = (key: string) => set(toggleIn(favs, key));
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { favs = parseFavs(e.newValue); l(); } }; // another tab starred something
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
}
/** Starred keys, re-rendering on change. */
export const useFavs = () => useSyncExternalStore(subscribe, () => favs, () => favs);
