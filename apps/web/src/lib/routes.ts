import { writable } from 'svelte/store';

/** Hash routing (Plan §2.4): `/#/r/{roomId}` — no server rewrites needed,
 * works identically on Firebase Hosting or GitHub Pages. */
export type Route = { name: 'lobby' } | { name: 'room'; roomId: string };

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, '');
  const match = /^\/r\/([^/]+)/.exec(clean);
  if (match?.[1]) return { name: 'room', roomId: decodeURIComponent(match[1]) };
  return { name: 'lobby' };
}

function createRouteStore() {
  const initial =
    typeof window !== 'undefined' ? parseHash(window.location.hash) : { name: 'lobby' as const };
  const { subscribe, set } = writable<Route>(initial);
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => set(parseHash(window.location.hash)));
  }
  return { subscribe };
}

export const route = createRouteStore();

export function navigateToRoom(roomId: string): void {
  window.location.hash = `/r/${encodeURIComponent(roomId)}`;
}

export function navigateToLobby(): void {
  window.location.hash = '/';
}

export function roomShareUrl(roomId: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/r/${encodeURIComponent(roomId)}`;
}
