import { QUICK_SHEETS } from './activities';
import type { MainViewId, OverlayId, QuickSheetId } from './types';

export type SheetOpenMap = Record<QuickSheetId, boolean>;

/** Mobile bottom-sheet snap points: a half-height peek or the full sheet. */
export type MobileSnap = 'half' | 'full';

interface Persisted {
  mainView: MainViewId;
  sheets: SheetOpenMap;
}

function closedSheets(): SheetOpenMap {
  return Object.fromEntries(QUICK_SHEETS.map((s) => [s.id, false])) as SheetOpenMap;
}

function isMainViewId(value: unknown): value is MainViewId {
  return value === 'map' || value === 'encounter' || value === 'assets';
}

/** Per-room shell UI state, persisted to `localStorage['vtt-shell:{roomId}']`
 * only — never Firestore (R1.3).
 *
 * Only the *durable* choices are persisted: which main view is on stage and
 * which quick sheets are docked open. Expansion, the mobile active sheet, its
 * snap height, and the Log/Session overlays are ephemeral session state and
 * reset on reload — an expanded modal or an open settings dialog surviving a
 * refresh would read as the app being stuck rather than as a restored
 * preference.
 */
export class ShellState {
  #storageKey: string;

  mainView = $state<MainViewId>('map');
  /** Desktop: each quick sheet's docked open/closed flag. Independent and
   * non-exclusive — any subset may be open, stacked down the left margin. */
  sheets = $state<SheetOpenMap>(closedSheets());

  // Ephemeral (not persisted):
  /** Mobile shows at most one quick sheet at a time, as a bottom sheet. */
  mobileActiveId = $state<QuickSheetId | null>(null);
  mobileSnap = $state<MobileSnap>('half');
  /** The one quick sheet currently expanded into a focused modal, if any —
   * global and exclusive across desktop and mobile. */
  expandedId = $state<QuickSheetId | null>(null);
  overlay = $state<OverlayId | null>(null);
  overlayTab = $state<'log' | 'notes'>('log');
  dialog = $state<'shortcuts' | null>(null);

  constructor(roomId: string) {
    this.#storageKey = `vtt-shell:${roomId}`;
    const loaded = this.#load();
    if (loaded) {
      this.mainView = loaded.mainView;
      this.sheets = loaded.sheets;
    }
  }

  #load(): Persisted | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.#storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      const sheets = closedSheets();
      const saved = (parsed.sheets ?? {}) as Partial<Record<string, unknown>>;
      for (const def of QUICK_SHEETS) sheets[def.id] = Boolean(saved[def.id]);
      return {
        // A pre-redesign payload persisted `activeActivity` instead; anything
        // unrecognised falls back to the Map stage rather than throwing.
        mainView: isMainViewId(parsed.mainView) ? parsed.mainView : 'map',
        sheets,
      };
    } catch {
      return null;
    }
  }

  #persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data: Persisted = {
        mainView: this.mainView,
        sheets: $state.snapshot(this.sheets),
      };
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
    } catch {
      // Storage full / disabled (private mode) — shell still works this session.
    }
  }

  // ---- main view ----

  setMainView(id: MainViewId): void {
    this.mainView = id;
    this.#persist();
  }

  // ---- quick sheets ----

  isSheetOpen(id: QuickSheetId, isMobile: boolean): boolean {
    if (this.expandedId === id) return true;
    return isMobile ? this.mobileActiveId === id : this.sheets[id];
  }

  /** Toggling is per-sheet and non-exclusive on desktop; on mobile only one
   * sheet can be active, so toggling a different one replaces it. */
  toggleSheet(id: QuickSheetId, isMobile: boolean): void {
    if (isMobile) {
      if (this.mobileActiveId === id) {
        this.mobileActiveId = null;
        if (this.expandedId === id) this.expandedId = null;
      } else {
        this.mobileActiveId = id;
        this.mobileSnap = 'half';
      }
      return;
    }
    const open = !this.sheets[id];
    this.sheets[id] = open;
    if (!open && this.expandedId === id) this.expandedId = null;
    this.#persist();
  }

  /** Expanding also *opens* the sheet, so collapsing has something to fall
   * back to, and collapses whichever sheet was expanded before. */
  expandSheet(id: QuickSheetId, isMobile: boolean): void {
    this.expandedId = id;
    if (isMobile) {
      this.mobileActiveId = id;
    } else {
      this.sheets[id] = true;
      this.#persist();
    }
  }

  collapseExpanded(): void {
    this.expandedId = null;
  }

  closeSheet(id: QuickSheetId): void {
    if (this.sheets[id]) {
      this.sheets[id] = false;
      this.#persist();
    }
    if (this.expandedId === id) this.expandedId = null;
    if (this.mobileActiveId === id) this.mobileActiveId = null;
  }

  cycleMobileSnap(): void {
    this.mobileSnap = this.mobileSnap === 'half' ? 'full' : 'half';
  }

  // ---- overlays ----

  openOverlay(id: OverlayId): void {
    this.overlay = id;
    if (id === 'log') this.overlayTab = 'log';
  }

  closeOverlay(): void {
    this.overlay = null;
  }

  openShortcuts(): void {
    this.dialog = 'shortcuts';
  }

  closeDialog(): void {
    this.dialog = null;
  }
}
