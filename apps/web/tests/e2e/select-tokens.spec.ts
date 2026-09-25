import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  addCreature,
  dragCanvas,
  openMapToolSheet,
  roomIdFromUrl,
  selectMapTool,
  signInAsReferee,
  switchToEditMode,
  VECTOR_CANVAS,
} from './helpers';

/**
 * Multi-token select (SPEC-056 §3, DEC-109, WI-181) — Select joins the View
 * group and gains a second catch besides geometry:
 *
 *  1. Select is never locked under View (unlike every carve/edit tool), and
 *     the geometry it can still pick there is read-only: selectable/
 *     inspectable, but Backspace does not remove it.
 *  2. Shift-click toggles a token into/out of the current selection, in
 *     either Edit or View.
 *  3. A lasso that catches any token selects tokens only, and dragging any
 *     selected token moves the whole set as one `moveTokens` batch — one
 *     undo entry, mirroring the collapsed-group anchor drag (SPEC-056 §2.3).
 *
 * Tokens were never gated by the View lock to begin with (a token's own
 * drag handler is independent of the active tool/mode), so the token-only
 * tests below never call `switchToEditMode` — running them against the
 * room's default View lock is itself part of the coverage.
 */

async function createRoomAndJoin(page: Page, roomName: string): Promise<string> {
  await signInAsReferee(page);
  await page.getByTestId('create-room-name').fill(roomName);
  await page.getByTestId('create-room-submit').click();
  await page.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(page.url());
  await expect(page.getByTestId('room-name')).toHaveText(roomName);
  return roomId;
}

/** Every token on the Map as `{ id, x, y }`, sorted left-to-right, read from
 * the hidden `token-pos-*` readouts. */
async function readTokens(page: Page): Promise<{ id: string; x: number; y: number }[]> {
  const rows = await page.locator('[data-testid^="token-pos-"]').all();
  const out: { id: string; x: number; y: number }[] = [];
  for (const row of rows) {
    const testId = (await row.getAttribute('data-testid'))!;
    const id = testId.replace('token-pos-', '');
    const [x, y] = (await row.textContent())!.split(',').map(Number);
    out.push({ id, x: x!, y: y! });
  }
  return out.sort((a, b) => a.x - b.x);
}

test('Select is never locked under View, and the geometry it holds there is read-only (SPEC-056 §3, DEC-109)', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Sealed Vestry');
  await switchToEditMode(page);

  // Place a door directly on open canvas — two clicks, no floor required.
  await selectMapTool(page, 'vector-tool-door');
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.click(box.x + 280, box.y + 200);
  await expect(page.getByTestId('door-count')).toHaveText('1');

  // Pick it up with a generous lasso rather than a pinpoint click — the two
  // clicks above are grid-snapped before becoming `a`/`b` (SPEC-028), so a
  // sweep that merely has to *contain* both snapped endpoints is far more
  // robust than guessing their exact lattice position. A sweep this size
  // only ever catches the one door on this otherwise-empty map.
  await selectMapTool(page, 'vector-tool-select');
  await dragCanvas(page, VECTOR_CANVAS, { x: 40, y: 40 }, { x: 440, y: 440 });
  const selectedObject = page.getByTestId('selected-object');
  const doorId = (await selectedObject.textContent())!.replace('door:', '');
  expect(doorId).not.toBe('');

  // Flip to View — Select stays enabled, unlike every carve/edit tool. The
  // toolbar assertions run before the sheet closes again, mirroring the
  // IN-031 lock test (`map-draw-feedback.spec.ts`).
  await openMapToolSheet(page);
  await page.getByTestId('map-mode-toggle').click();
  await expect(page.getByTestId('vector-tool-select')).toBeEnabled();
  await expect(page.getByTestId('vector-tool-wall')).toBeDisabled();
  await page.getByTestId('quick-sheet-close-maptools').click();

  // The same lasso under View still selects it (inspect)...
  await dragCanvas(page, VECTOR_CANVAS, { x: 40, y: 40 }, { x: 440, y: 440 });
  await expect(selectedObject).toHaveText(`door:${doorId}`);

  // ...but Backspace does not remove it.
  await page.keyboard.press('Backspace');
  await expect(page.getByTestId('door-count')).toHaveText('1');
});

test('Shift-click toggles a token into and out of the multi-selection, in either Edit or View (SPEC-056 §3, DEC-109)', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Gathering Hall');
  // Default View lock — deliberately not switched to Edit: token selection
  // is unaffected by the lock.
  await addCreature(page, { count: 3, bundledRef: 'goblin' });
  const [a, b] = await readTokens(page);
  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;

  const count = page.getByTestId('selected-token-count');
  await expect(count).toHaveText('0');

  await page.mouse.click(box.x + a!.x, box.y + a!.y);
  await expect(count).toHaveText('1');

  // Held for both clicks, the way a referee would actually multi-select —
  // releasing and re-pressing Shift between two clicks this close together
  // is its own thing to get right and isn't what the gesture is about.
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + b!.x, box.y + b!.y);
  await expect(count).toHaveText('2');

  // Shift-click the first token again — toggled back out.
  await page.mouse.click(box.x + a!.x, box.y + a!.y);
  await expect(count).toHaveText('1');
  await page.keyboard.up('Shift');
});

test('A lasso catching tokens selects tokens only, and dragging any selected token moves the whole set as one undoable batch (SPEC-056 §3, DEC-109)', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Drifting Cairn');
  // Default View lock, unswitched — the drag below exercises tokens staying
  // fully live under it.
  await addCreature(page, { count: 3, bundledRef: 'goblin' });
  const initial = await readTokens(page);
  const [a, b, c] = initial;
  const offAB = { x: b!.x - a!.x, y: b!.y - a!.y };
  const offAC = { x: c!.x - a!.x, y: c!.y - a!.y };

  await selectMapTool(page, 'vector-tool-select');
  const box = (await page.locator(VECTOR_CANVAS).boundingBox())!;

  // Sweep a lasso around all three — well clear of every token's centre on
  // every side, since `addCreature` steps them one cell to the right.
  await dragCanvas(
    page,
    VECTOR_CANVAS,
    { x: a!.x - 40, y: a!.y - 40 },
    { x: c!.x + 40, y: c!.y + 40 },
  );
  await expect(page.getByTestId('selected-token-count')).toHaveText('3');
  // Tokens win: no geometry caught alongside them.
  await expect(page.getByTestId('selection-count')).toHaveText('0');

  // Drag the first (already-selected) token, no Shift held — the whole set
  // moves together, one batch.
  await dragCanvas(page, VECTOR_CANVAS, { x: a!.x, y: a!.y }, { x: a!.x + 70, y: a!.y + 130 });
  await expect(page.getByTestId('last-batch-move-count')).toHaveText('3');
  await expect(page.locator(`[data-testid="token-pos-${a!.id}"]`)).not.toHaveText(`${a!.x},${a!.y}`);

  async function expectFormationIntact(): Promise<void> {
    const moved = await readTokens(page);
    const anchor = moved.find((t) => t.id === a!.id)!;
    const mb = moved.find((t) => t.id === b!.id)!;
    const mc = moved.find((t) => t.id === c!.id)!;
    expect({ x: mb.x - anchor.x, y: mb.y - anchor.y }).toEqual(offAB);
    expect({ x: mc.x - anchor.x, y: mc.y - anchor.y }).toEqual(offAC);
  }
  await expectFormationIntact();

  // One Ctrl+Z restores every member, not just the one that was grabbed.
  await page.keyboard.press('Control+z');
  const restored = await readTokens(page);
  for (const t of initial) {
    const back = restored.find((r) => r.id === t.id)!;
    expect(`${back.x},${back.y}`).toBe(`${t.x},${t.y}`);
  }
});
