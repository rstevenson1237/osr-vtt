import type { Page } from '@playwright/test';

/**
 * Activity Shell navigation (Master Plan v2, R1 / WI-2). The room UI now hosts
 * one activity at a time behind the left Activities rail instead of the old
 * always-visible sidebars. Clicking an activity tab either switches the stage
 * (Map, Encounter, Log, Session, Assets) or opens a docked mini-card
 * (Dice, Characters) — in both cases the re-housed panel and its testids become
 * reachable. These helpers replace the retired `stage-tab-map`/`stage-tab-board`
 * toggles.
 */
export async function openActivity(
  page: Page,
  id: 'map' | 'encounter' | 'dice' | 'characters' | 'log' | 'session' | 'assets',
): Promise<void> {
  const tab = page.getByTestId(`activity-tab-${id}`);
  // Skip the click when the tab is already the active one. Re-clicking the
  // active tab is a no-op for the app but has intermittently hung in CI (the
  // click can't settle while the freshly-mounted map/Pixi stage is still
  // initializing) — and a real user never clicks the activity they're already
  // on. Waiting on aria-pressed also ensures the target activity is actually
  // selected before we proceed.
  if ((await tab.getAttribute('aria-pressed')) === 'true') return;
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

/** On the mobile shell, every map tool (draw tools + the reused symbol/label
 * rail) lives inside the drag-handle tool sheet (`ToolSheet.svelte`), which
 * starts closed — tapping its handle cycles closed → half → full. The
 * desktop docked Tools rail has no such gate, so this no-ops there (and
 * no-ops if the sheet is already open). Needed before clicking any
 * `vector-tool-*`/`map-tool-*` button on mobile. */
async function openMapToolSheetIfMobile(page: Page): Promise<void> {
  const sheet = page.getByTestId('tool-sheet');
  if ((await sheet.count()) === 0) return;
  if ((await sheet.getAttribute('data-snap')) === 'closed') {
    await page.getByTestId('tool-sheet-handle').click();
  }
}

/** Carves a rectangular floor region with the vector Room tool (the vector
 * successor to the cellular Carve tool). Returns after the drag settles. */
export async function vectorCarve(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await openMapToolSheetIfMobile(page);
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
