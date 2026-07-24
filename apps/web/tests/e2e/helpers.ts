import { expect, type Page } from '@playwright/test';

/**
 * Shell navigation (Master Plan v2, R1; restructured by the Shell UI Redesign).
 * The room UI is now a single full-screen main view (Map / Encounter / Assets)
 * plus independently toggled quick sheets and two modal overlays. This helper
 * keeps one call site for the specs and routes each legacy "activity" id to
 * wherever its panel now lives:
 *
 * - `map` / `encounter` / `assets` — the main-view tabs.
 * - `dice` → the Roll quick sheet, expanded (the full `DiceTray` only mounts in
 *   the expanded view, so `tray-*` / `roll-button` stay reachable).
 * - `characters` → the Character quick sheet, expanded.
 * - `log` / `session` → the Log and Session settings modals.
 *
 * Anything already open that would swallow the click (a backdrop) is dismissed
 * first, so consecutive calls behave the way they did against the old rail.
 */
export type ActivityId = 'map' | 'encounter' | 'dice' | 'characters' | 'log' | 'session' | 'assets';

const SHEET_FOR: Partial<Record<ActivityId, string>> = {
  dice: 'roll',
  characters: 'character',
};

/** Closes an expanded quick sheet or an open Log/Session modal, if any. */
export async function dismissShellOverlays(page: Page): Promise<void> {
  const backdrop = page.locator('.sheet-backdrop, [data-testid="overlay-close"]');
  while ((await backdrop.count()) > 0) {
    await page.keyboard.press('Escape');
    await expect(backdrop).toHaveCount(0, { timeout: 2000 });
  }
}

/** Closes a quick sheet entirely (collapsing it first if it is expanded), so
 * the stage underneath is clickable again. */
export async function closeQuickSheet(
  page: Page,
  sheet: 'maptools' | 'character' | 'roll' | 'room',
): Promise<void> {
  await dismissShellOverlays(page);
  const card = page.getByTestId(`quick-sheet-${sheet}`);
  if ((await card.count()) === 0) return;
  await page.getByTestId(`quick-sheet-close-${sheet}`).click();
  await expect(card).toHaveCount(0);
}

export async function openActivity(page: Page, id: ActivityId): Promise<void> {
  await dismissShellOverlays(page);

  if (id === 'log') {
    await page.getByTestId('log-open').click();
    await page.getByTestId('log-overlay').waitFor({ state: 'visible' });
    return;
  }

  if (id === 'session') {
    // The gear lives in the desktop Session tab and, on mobile, in the compact
    // top bar under its original bottom-bar testid.
    const desktop = page.getByTestId('session-shortcut');
    const gear =
      (await desktop.count()) > 0 ? desktop : page.getByTestId('mobile-activity-session');
    await gear.click();
    await page.getByTestId('session-overlay').waitFor({ state: 'visible' });
    return;
  }

  const sheet = SHEET_FOR[id];
  if (sheet) {
    const toggle = page.getByTestId(`quick-sheet-toggle-${sheet}`);
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
    await page.getByTestId(`quick-sheet-expand-${sheet}`).click();
    await page.getByTestId(`quick-sheet-collapse-${sheet}`).waitFor({ state: 'visible' });
    return;
  }

  const tab = page.getByTestId(`activity-tab-${id}`);
  // Skip the click when the tab is already the active one. Re-clicking the
  // active tab is a no-op for the app but has intermittently hung in CI (the
  // click can't settle while the freshly-mounted map/Pixi stage is still
  // initializing) — and a real user never clicks the view they're already
  // on. Waiting on aria-selected also ensures the target view is actually
  // selected before we proceed.
  if ((await tab.getAttribute('aria-selected')) === 'true') return;
  await tab.click();
}

export function roomIdFromUrl(url: string): string {
  const hash = new URL(url).hash; // "#/r/<roomId>"
  const match = /^#\/r\/([^/]+)/.exec(hash);
  if (!match?.[1]) throw new Error(`Could not extract roomId from URL: ${url}`);
  return decodeURIComponent(match[1]);
}

/**
 * GM "Add creature" flow (Master Plan v2, R7.3/WI-9) — replaces the old
 * debug "drop starter token" button. Opens the token picker (defaults to
 * the first Bundled ref), optionally sets a count, and confirms — the first
 * creature always lands at the map's `STARTER_DROP_POS` (160,160), same as
 * the old debug button, so tests anchored to that position still hold.
 */
export async function addCreature(
  page: Page,
  opts?: { count?: number; bundledRef?: string; groupName?: string },
): Promise<void> {
  await page.getByTestId('add-creature').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'visible' });
  if (opts?.bundledRef) {
    await page.getByTestId(`asset-option-bundled-${opts.bundledRef}`).click();
  }
  if (opts?.count) {
    await page.getByTestId('token-picker-count').fill(String(opts.count));
  }
  if (opts?.groupName) {
    await page.getByTestId('token-picker-group-name').fill(opts.groupName);
  }
  await page.getByTestId('token-picker-confirm').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'detached' });
}

/** The vector map editor's canvas selector (replaces the cellular `map-canvas`
 * after the WI-D hard cutover — `VectorMapView` is now the only map view). */
export const VECTOR_CANVAS = '[data-testid="vector-map-canvas"] canvas';

/** Every map tool now lives in the Map tools quick sheet, which starts closed
 * on both layouts (the old always-expanded right Tools rail is gone). Opens it
 * if needed; no-ops when it is already open. Needed before clicking any
 * `vector-tool-*`/`map-tool-*` button. */
export async function openMapToolSheet(page: Page): Promise<void> {
  await dismissShellOverlays(page);
  const toggle = page.getByTestId('quick-sheet-toggle-maptools');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await page.getByTestId('quick-sheet-maptools').waitFor({ state: 'visible' });
}

/** Carves a rectangular floor region with the vector Room tool (the vector
 * successor to the cellular Carve tool). Returns after the drag settles. */
export async function vectorCarve(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await openMapToolSheet(page);
  await page.getByTestId('vector-tool-room').click();
  await dragCanvas(page, VECTOR_CANVAS, from, to);
}

/** Simulates a real mouse drag over the PixiJS canvas — Playwright dispatches
 * genuine DOM pointer/mouse events, which Pixi's interaction manager listens
 * to on the canvas element, so this exercises the real drag path. */
export async function dragCanvas(
  page: Page,
  canvasSelector: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const canvas = page.locator(canvasSelector);
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`Canvas not found/visible: ${canvasSelector}`);

  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 12 });
  await page.mouse.up();
}
