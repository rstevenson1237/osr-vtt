export { hexToNumber, readMapTheme, type MapTheme } from './map-theme';

/**
 * Theme selection (R2). Room-level `room.settings.theme` is the real source
 * of truth (GM-set, so every player sees the same map colors) — the Session
 * Config UI to change it doesn't land until WI-6, so until then a `?theme=`
 * query param overrides it for preview/QA. The query param always wins.
 */
export type ThemeName = 'parchment-dark' | 'keyed-blue';

export const THEMES: ThemeName[] = ['parchment-dark', 'keyed-blue'];

export const DEFAULT_THEME: ThemeName = 'parchment-dark';

export function isThemeName(value: string | null | undefined): value is ThemeName {
  return value != null && (THEMES as string[]).includes(value);
}

export function resolveThemeName(roomTheme: string | null | undefined): ThemeName {
  if (typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('theme');
    if (isThemeName(override)) return override;
  }
  return isThemeName(roomTheme) ? roomTheme : DEFAULT_THEME;
}

/** Stamps `data-theme` on the root element — every token in `tokens.css` is
 * scoped off this attribute, and `MapView` reacts to it via `readMapTheme()`
 * + `engine.setTheme()`. */
export function applyTheme(name: ThemeName): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset['theme'] = name;
}
