import { expect, type Page, test } from '@playwright/test';
import {
  closeQuickSheet,
  expandQuickSheet,
  openActivity,
  roomIdFromUrl,
  selectMapTool,
  vectorCarve,
  VECTOR_CANVAS,
  signInAsReferee,
} from './helpers';

/**
 * Mobile / tablet smoke suite (Master Plan v2, R1.8 / WI-3, Gate 3; updated for
 * the Shell UI Redesign). Runs under the `mobile-chromium` Playwright project (a
 * touch phone viewport < 900px), so the room renders its mobile chrome: compact
 * top bar, full-screen main view, a row of quick-sheet chips, and the pinned
 * main-view tab bar. Quick sheets open as bottom sheets; Log and Session
 * settings open full-screen. No docked rails.
 *
 * Verifies the CI-checkable half of Gate 3: phone-sized viewport shows the
 * single-view UI with no horizontal overflow, views switch from the bottom bar,
 * a region carves, and dice roll. Real pinch/pan/tool-touch on a physical tablet
 * is the [HUMAN] half of the gate.
 */

async function createRoomAndJoin(
  page: Page,
  roomName: string,
  displayName: string,
): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

test('mobile shell: switch main views, carve, and roll', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // --- The mobile chrome is present and the desktop rails are not. ---
  await expect(page.getByTestId('app-shell-mobile')).toBeVisible();
  await expect(page.getByTestId('mobile-activity-bar')).toBeVisible();
  await expect(page.getByTestId('mobile-top-bar')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-chips')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-rail')).toHaveCount(0);

  // --- No horizontal overflow at phone width (Gate 3). ---
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // --- The Log opens as a full-screen modal over the stage, not as a view. ---
  await openActivity(page, 'log');
  await expect(page.getByTestId('log-activity')).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(page.getByTestId('log-overlay')).toHaveCount(0);
  await expect(page.locator(VECTOR_CANVAS)).toBeVisible();

  // --- Carve a floor region with the vector Room tool. Every map tool now
  // lives inside the Map tools quick sheet, which starts closed —
  // `vectorCarve` opens it first. ---
  await vectorCarve(page, { x: 50, y: 40 }, { x: 170, y: 110 });
  await expect(page.getByTestId('floor-region-count')).not.toHaveText('0');

  // --- Dice roll from the expanded Roll sheet. Summed mode so the shared
  // overlay shows a single total (Separate renders per-die badges). ---
  await openActivity(page, 'dice');
  await page.getByTestId('tray-add-d20').click();
  await page.getByTestId('tray-mode-summed').click();
  await page.getByTestId('roll-button').click();
  await expect(page.getByTestId('last-roll-total')).toBeVisible();
});

test('mobile shell: quick sheets are one-at-a-time bottom sheets', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // The GM-only Session settings gear is reachable on mobile too (no rail
  // grouping, but availability filtering still applies).
  await expect(page.getByTestId('mobile-activity-session')).toHaveCount(1);

  await page.getByTestId('activity-tab-encounter').click();
  await expect(page.getByTestId('encounter-board')).toBeVisible();

  await page.getByTestId('activity-tab-assets').click();
  await expect(page.getByTestId('assets-activity')).toBeVisible();

  await openActivity(page, 'session');
  await expect(page.getByTestId('session-activity')).toBeVisible();
  await page.keyboard.press('Escape');

  // Unlike desktop, opening a second quick sheet replaces the first — there is
  // only room for one bottom sheet.
  await page.getByTestId('quick-sheet-toggle-roll').click();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveAttribute('data-mode', 'mobile');
  await page.getByTestId('quick-sheet-toggle-character').click();
  await expect(page.getByTestId('quick-sheet-character')).toBeVisible();
  await expect(page.getByTestId('quick-sheet-roll')).toHaveCount(0);

  // The grip toggles the sheet between its half-height peek and full height.
  const sheet = page.getByTestId('quick-sheet-character');
  const halfHeight = (await sheet.boundingBox())!.height;
  await page.getByTestId('quick-sheet-grip-character').click();
  await expect.poll(async () => (await sheet.boundingBox())!.height).toBeGreaterThan(halfHeight);
});

/**
 * SPEC-033 §4 / DEC-059 — a coarse pointer never gets a gesture, it gets a
 * target. This project is the only one that runs on a coarse pointer (`Pixel
 * 5`: `(pointer: coarse)` matches, `(hover: hover)` does not), so it is the
 * only place the note dot exists to be tested.
 *
 * The dot itself is drawn in Pixi, hence the `maproom-note-dot-*` readout —
 * a bitmap is not assertable, the mirror of the decision behind it is.
 */
test('map: a note dot pins the label tooltip a mouse gets by hovering', async ({ page }) => {
  await createRoomAndJoin(page, 'The Sunken Crypt', 'Referee');

  // A label wants floor to sit on.
  await vectorCarve(page, { x: 40, y: 40 }, { x: 300, y: 300 });
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;

  await selectMapTool(page, 'vector-tool-label');
  await page.mouse.click(box.x + 150, box.y + 150);
  await expect(page.getByTestId('label-edit-input')).toBeVisible();

  // The editor is `translate(-50%, -50%)`-anchored on the label's cell centre,
  // so its box centre *is* that centre. A click at canvas (150, 150) with the
  // default 70px cells and an un-panned camera falls in cell (2, 2), whose
  // centre is (2.5, 2.5) × 70 = (175, 175). Asserting that pins down the zoom
  // and offset the rest of this test's arithmetic assumes — if the default
  // camera ever changes, this line fails rather than the tap silently missing.
  const editor = (await page.getByTestId('label-edit-input').boundingBox())!;
  const labelCentre = { x: editor.x + editor.width / 2, y: editor.y + editor.height / 2 };
  expect(labelCentre.x - box.x).toBeCloseTo(175, 0);
  expect(labelCentre.y - box.y).toBeCloseTo(175, 0);

  await page.getByTestId('label-edit-input').fill('Entry Hall');
  await page.getByTestId('label-edit-input').press('Tab');
  await expect(page.getByTestId('label-edit-input')).toHaveCount(0);

  const roomTestId = await page
    .locator('[data-testid^="maproom-name-"]')
    .first()
    .getAttribute('data-testid');
  const mapRoomId = roomTestId!.replace('maproom-name-', '');

  // No notes, no dot: it advertises exactly the labels worth tapping, which is
  // the same non-empty test that gates the tooltip on a fine pointer.
  await expect(page.getByTestId(`maproom-note-dot-${mapRoomId}`)).toHaveText('false');

  await expandQuickSheet(page, 'room');
  await page.getByTestId(`room-key-${mapRoomId}`).click();
  await page.getByTestId(`room-notes-${mapRoomId}-input`).fill('Two braziers, one dead rat.');
  await closeQuickSheet(page, 'room');

  await expect(page.getByTestId(`maproom-note-dot-${mapRoomId}`)).toHaveText('true');

  // Half a cell above the label centre — the dot rides the label cell's top
  // edge, clear of the chip.
  const dot = { x: labelCentre.x, y: labelCentre.y - 35 };
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);

  // A tap on the dot pins the tooltip, and — with the Label tool still in hand
  // — does *not* place a label: the dot consumes the tap before the tool sees
  // it, which is the whole reason it is a dot and not a long-press.
  await page.mouse.click(dot.x, dot.y);
  await expect(page.getByTestId('map-label-tooltip')).toContainText('one dead rat');
  await expect(page.locator('[data-testid^="maproom-name-"]')).toHaveCount(1);

  // Pinned, not hovered: it stays put with no pointer resting on it, and a
  // second tap on the same dot closes it.
  await page.mouse.click(dot.x, dot.y);
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);

  // Re-pinned, then dismissed by the label entering its editor — a tap on the
  // label itself, which is far enough below the dot to reach the Label tool.
  await page.mouse.click(dot.x, dot.y);
  await expect(page.getByTestId('map-label-tooltip')).toContainText('one dead rat');
  await page.mouse.click(labelCentre.x, labelCentre.y);
  await expect(page.getByTestId('label-edit-input')).toBeVisible();
  await expect(page.getByTestId('map-label-tooltip')).toHaveCount(0);
});
