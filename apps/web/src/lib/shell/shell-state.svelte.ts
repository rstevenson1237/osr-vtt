import type { ActivityId } from './types';

/** The Activities rail's single open mini-card, if any (R1.3 — "exactly one
 * mini-card open per rail"). The Tools rail is a *collapsible docked panel*
 * rather than a flyout, because its palette must stay pinned while the user
 * works on the stage/canvas (a stage-click must not dismiss it). */
export type Flyout = { rail: 'activities'; activity: ActivityId } | null;

interface Persisted {
  activeActivity: ActivityId;
  drawerExpanded: boolean;
  drawerHeight: number;
  toolsCollapsed: boolean;
}

const DRAWER_MIN = 120;
const DRAWER_MAX = 420;

function clampDrawer(h: number): number {
  return Math.max(DRAWER_MIN, Math.min(DRAWER_MAX, Math.round(h)));
}

/** Per-room shell UI state, persisted to `localStorage['vtt-shell:{roomId}']`
 * only — never Firestore (R1.3). Flyout/dialog state is ephemeral and reset on
 * reload. */
export class ShellState {
  #storageKey: string;

  activeActivity = $state<ActivityId>('map');
  drawerExpanded = $state(false);
  drawerHeight = $state(180);
  /** Tools rail starts expanded so the current activity's tools are visible;
   * collapsing it (with the rails) is what yields the ≥90% stage (Gate 2). */
  toolsCollapsed = $state(false);

  // Ephemeral (not persisted):
  flyout = $state<Flyout>(null);
  dialog = $state<'shortcuts' | null>(null);

  constructor(roomId: string) {
    this.#storageKey = `vtt-shell:${roomId}`;
    const loaded = this.#load();
    if (loaded) {
      this.activeActivity = loaded.activeActivity;
      this.drawerExpanded = loaded.drawerExpanded;
      this.drawerHeight = clampDrawer(loaded.drawerHeight);
      this.toolsCollapsed = loaded.toolsCollapsed;
    }
  }

  #load(): Persisted | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.#storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      if (typeof parsed.activeActivity !== 'string') return null;
      return {
        activeActivity: parsed.activeActivity as ActivityId,
        drawerExpanded: Boolean(parsed.drawerExpanded),
        drawerHeight: typeof parsed.drawerHeight === 'number' ? parsed.drawerHeight : 180,
        toolsCollapsed: Boolean(parsed.toolsCollapsed),
      };
    } catch {
      return null;
    }
  }

  #persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data: Persisted = {
        activeActivity: this.activeActivity,
        drawerExpanded: this.drawerExpanded,
        drawerHeight: this.drawerHeight,
        toolsCollapsed: this.toolsCollapsed,
      };
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
    } catch {
      // Storage full / disabled (private mode) — shell still works this session.
    }
  }

  /** GM-only activities may be requested via keyboard even if not visible; the
   * caller is responsible for passing a valid id (see `activityForDigit`). */
  setActivity(id: ActivityId): void {
    this.activeActivity = id;
    this.flyout = null;
    this.#persist();
  }

  /** Open the given activity's mini-card, or close it if already open (one
   * mini-card per rail). */
  toggleFlyout(activity: ActivityId): void {
    const cur = this.flyout;
    this.flyout = cur && cur.activity === activity ? null : { rail: 'activities', activity };
  }

  closeFlyout(): void {
    this.flyout = null;
  }

  toggleTools(): void {
    this.toolsCollapsed = !this.toolsCollapsed;
    this.#persist();
  }

  toggleDrawer(): void {
    this.drawerExpanded = !this.drawerExpanded;
    this.#persist();
  }

  setDrawerHeight(h: number): void {
    this.drawerHeight = clampDrawer(h);
    this.#persist();
  }

  openShortcuts(): void {
    this.dialog = 'shortcuts';
  }

  closeDialog(): void {
    this.dialog = null;
  }
}
