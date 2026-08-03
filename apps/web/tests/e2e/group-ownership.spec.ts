import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  addCreature,
  claimOwnToken,
  closeQuickSheet,
  dragCanvas,
  expandQuickSheet,
  openActivity,
  roomIdFromUrl,
  tokenIds,
  VECTOR_CANVAS,
  signInAsReferee,
} from './helpers';

/**
 * Group ownership, and the two directions the Map and the Character sheet now
 * talk to each other.
 *
 * Authority used to sit on the token (`Token.ownerSeatId`) and gate nothing. It
 * is a property of the **Group** now: a seat listed on a group may act as every
 * character in it, the referee is in every group implicitly, and a newly joined
 * seat lands wherever `RoomSettings.defaultPlayerGroup` says. `ownerSeatId`
 * survives meaning only "which character profile this token shows".
 *
 * Covered here:
 *  1. Default player group — the referee picks one, a joining player is placed
 *     in it by the referee's client, and deleting that group puts the setting
 *     back to First.
 *  2. Group access — a groupmate's sheet is editable; a character outside every
 *     group you own is read-only.
 *  3. Map token → Character sheet, with the back link to your own character.
 *  4. Sheet portrait → Map: dragging it moves that character's token to where
 *     it was dropped.
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

async function joinRoom(page: Page, roomId: string, displayName: string): Promise<void> {
  await page.goto(`/#/r/${roomId}`);
  await page.getByTestId('join-display-name').fill(displayName);
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('room-name')).toBeVisible();
}

/** Promotes the Unassigned bin into a named group and returns its id. The
 * referee must already be on the Encounter board. */
async function promoteBin(page: Page, name: string): Promise<string> {
  const bin = page.getByTestId('cast-section-unassigned');
  await bin.locator('h3').dblclick();
  await page.getByTestId('group-name-input-unassigned').fill(name);
  await page.getByTestId('group-name-input-unassigned').press('Enter');
  const box = page
    .locator('[data-testid^="cast-section-"]')
    .filter({ has: page.locator('h3', { hasText: name }) });
  await expect(box).toHaveCount(1);
  return (await box.getAttribute('data-testid'))!.replace('cast-section-', '');
}

test('the default player group places a joining seat, and survives its group being deleted', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunken Chapel', 'Referee');

  // A group to put people in. Promoting the bin is the only creation path.
  await addCreature(gm);
  await openActivity(gm, 'encounter');
  const partyId = await promoteBin(gm, 'The Party');

  // Point the setting at it explicitly, rather than leaning on "First".
  await openActivity(gm, 'session');
  const setting = gm.getByTestId('session-default-group');
  await expect(setting).toHaveValue('first');
  await setting.selectOption(partyId);
  await expect(setting).toHaveValue(partyId);

  // A player joins. Groups are GM-write-only, so it is the *referee's* client
  // that places them — which is why the referee is the one asserting it.
  await joinRoom(player, roomId, 'Player One');
  await openActivity(gm, 'encounter');
  const seatBox = gm
    .locator(`[data-testid^="group-seat-${partyId}-"]`)
    .filter({ hasNot: gm.locator(':disabled') });
  await expect(seatBox.first()).toBeChecked();

  // Deleting the chosen group falls the setting back to First rather than
  // leaving it pointing at nothing.
  await gm.getByTestId(`group-delete-${partyId}`).click();
  await gm.getByTestId('confirm-dialog-confirm').click();
  await openActivity(gm, 'session');
  await expect(gm.getByTestId('session-default-group')).toHaveValue('first');

  await gmContext.close();
  await playerContext.close();
});

test('a group owner may play every character in the group, and no others', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const oneContext = await browser.newContext();
  const twoContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const one = await oneContext.newPage();
  const two = await twoContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunken Chapel', 'Referee');

  // Ownership is assigned by hand in this test, so switch the default off
  // first — otherwise the referee's client would place both joiners in the one
  // group that exists and there would be no non-owner left to check.
  await openActivity(gm, 'session');
  await gm.getByTestId('session-default-group').selectOption('unassigned');
  await openActivity(gm, 'map');

  await joinRoom(one, roomId, 'Player One');
  await joinRoom(two, roomId, 'Player Two');

  // Each player gives themselves a token, which is what links it to their
  // Profile now that the referee's Actor Ownership panel is gone.
  const oneToken = await claimOwnToken(one);
  const twoToken = await claimOwnToken(two);

  // Both characters into one group, and Player One owns it.
  await openActivity(gm, 'encounter');
  const partyId = await promoteBin(gm, 'The Party');
  await expect(gm.getByTestId(`board-token-${oneToken}`)).toBeVisible();
  await expect(gm.getByTestId(`board-token-${twoToken}`)).toBeVisible();

  // One checkbox per seat on the group card. The referee's own is checked and
  // disabled, because GM membership is derived from `Room.gmUid` rather than
  // stored — a transfer moves it across every group with no writes.
  const seatRow = (name: string) =>
    gm.getByTestId(`group-card-${partyId}`).locator('li').filter({ hasText: name });
  await expect(seatRow('Referee').getByRole('checkbox')).toBeDisabled();
  await expect(seatRow('Referee').getByRole('checkbox')).toBeChecked();

  // Only Player One owns the group. Player Two's character is in it, but Player
  // Two is not an owner of it.
  await seatRow('Player One').getByRole('checkbox').check();
  await expect(seatRow('Player Two').getByRole('checkbox')).not.toBeChecked();

  // Player One opens Player Two's character from the board: same group, so it
  // is theirs to play — editable, not a read-only view.
  await openActivity(one, 'encounter');
  await one.getByTestId(`board-token-${twoToken}`).click();
  await expandQuickSheet(one, 'character');
  const field = one.locator('[data-testid^="field-input-"]').first();
  await expect(field).toBeEnabled();
  // Playing a groupmate's character makes it the current one, so the way home
  // is the explicit back link — which returns to this player's *own* profile
  // and clears that pointer, rather than undoing one selection.
  await expect(one.getByTestId('dock-back-to-mine')).toBeVisible();
  await one.getByTestId('dock-back-to-mine').click();
  await expect(one.getByTestId('dock-back-to-mine')).toHaveCount(0);
  await closeQuickSheet(one, 'character');

  // Player Two owns no group, so Player One's character is a read-only view.
  await openActivity(two, 'encounter');
  await two.getByTestId(`board-token-${oneToken}`).click();
  await expandQuickSheet(two, 'character');
  await expect(two.locator('[data-testid^="field-input-"]').first()).toBeDisabled();

  await gmContext.close();
  await oneContext.close();
  await twoContext.close();
});

test('clicking a token on the map raises its character sheet, and the portrait drags back onto the map', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Sunken Chapel', 'Referee');
  const tokenId = await claimOwnToken(page);

  // --- Map token -> Character sheet ---
  // Nothing is selected until a token is picked up.
  await expect(page.getByTestId('selected-actor')).toHaveText('');
  const before = (await page.getByTestId(`token-pos-${tokenId}`).textContent())!;
  const canvas = page.locator(VECTOR_CANVAS);
  const box = (await canvas.boundingBox())!;
  const [bx, by] = before.split(',').map(Number);
  await page.mouse.move(box.x + bx!, box.y + by!);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('selected-actor')).not.toHaveText('');

  // --- Character sheet portrait -> Map ---
  // The docked sheet is enough; expanding it would cover the canvas.
  await page.getByTestId('quick-sheet-toggle-character').click();
  const portrait = page.getByTestId('dock-portrait');
  await expect(portrait).toHaveAttribute('draggable', 'true');

  // HTML5 drag-and-drop, the same channel the board's card drags use — the map
  // takes this as a DOM drop rather than a Pixi pointer event.
  await portrait.dragTo(canvas, {
    targetPosition: { x: Math.round(box.width * 0.7), y: Math.round(box.height * 0.6) },
  });

  await expect(page.getByTestId(`token-pos-${tokenId}`)).not.toHaveText(before);
  // Still exactly one token — the drag moved it, it did not clone it.
  await expect(page.locator('[data-testid^="token-pos-"]')).toHaveCount(1);
});

test('a creature card is selectable and its quick sheet renders a creature profile, editable only by an owning group or the referee (SPEC-032 §4)', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const owner = await ownerContext.newPage();
  const outsider = await outsiderContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunken Chapel', 'Referee');

  // Ownership is assigned by hand below, so switch the default group off
  // first — otherwise the referee's client places every joining seat in the
  // one group that ends up existing, and there is no non-owner left to check.
  await openActivity(gm, 'session');
  await gm.getByTestId('session-default-group').selectOption('unassigned');
  await openActivity(gm, 'map');

  await joinRoom(owner, roomId, 'Owner');
  await joinRoom(outsider, roomId, 'Outsider');

  // A lone creature — `addCreature` leaves it ungrouped and seatless.
  const before = new Set(await tokenIds(gm));
  await addCreature(gm, { bundledRef: 'goblin' });
  const creatureId = (await tokenIds(gm)).find((id) => !before.has(id))!;

  // The referee can act on anything: selectable, editable, no "My token"
  // (a creature already is a token — there is no seat to assign one to), and
  // a colour control with nothing pre-selected (DEC-042: no always-present
  // guarantee for a creature).
  await openActivity(gm, 'encounter');
  await gm.getByTestId(`board-token-${creatureId}`).click();
  await expandQuickSheet(gm, 'character');
  await expect(gm.getByTestId('dock-name')).toHaveText('goblin');
  await expect(gm.getByTestId('my-token')).toHaveCount(0);
  for (const i of [0, 1, 2, 3, 4, 5]) {
    await expect(gm.getByTestId(`token-color-swatch-${i}`)).not.toHaveClass(/selected/);
  }
  await expect(gm.locator('[data-testid^="field-input-"]').first()).toBeEnabled();
  await gm.getByTestId('token-color-swatch-0').click();
  await expect(gm.getByTestId('token-color-swatch-0')).toHaveClass(/selected/);
  await closeQuickSheet(gm, 'character');

  // Put it in a group that only "Owner" owns.
  const partyId = await promoteBin(gm, 'The Party');
  const seatRow = (name: string) =>
    gm.getByTestId(`group-card-${partyId}`).locator('li').filter({ hasText: name });
  await seatRow('Owner').getByRole('checkbox').check();
  await expect(seatRow('Outsider').getByRole('checkbox')).not.toBeChecked();

  // The owning seat may act on it — editable, exactly like a groupmate's
  // character (SPEC-032 §3's token-keyed sibling of `canSeatActAs`).
  await openActivity(owner, 'encounter');
  await owner.getByTestId(`board-token-${creatureId}`).click();
  await expandQuickSheet(owner, 'character');
  await expect(owner.locator('[data-testid^="field-input-"]').first()).toBeEnabled();
  await closeQuickSheet(owner, 'character');

  // A non-owner may still select it — the card is not gated on ownership,
  // only editing is — but its sheet renders read-only.
  await openActivity(outsider, 'encounter');
  await outsider.getByTestId(`board-token-${creatureId}`).click();
  await expandQuickSheet(outsider, 'character');
  await expect(outsider.locator('[data-testid^="field-input-"]').first()).toBeDisabled();

  await gmContext.close();
  await ownerContext.close();
  await outsiderContext.close();
});

test('map token drag is gated on the same ownership predicate as the sheet (SPEC-032 §5)', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const ownerContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const owner = await ownerContext.newPage();
  const outsider = await outsiderContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Sunken Chapel', 'Referee');

  await openActivity(gm, 'session');
  await gm.getByTestId('session-default-group').selectOption('unassigned');
  await openActivity(gm, 'map');

  await joinRoom(owner, roomId, 'Owner');
  await joinRoom(outsider, roomId, 'Outsider');

  // First creature: promoting the Unassigned bin right after sweeps only it
  // into "The Party", leaving the *next* creature in a fresh, empty
  // Unassigned bin — i.e. genuinely ungrouped scenery (DEC-036).
  const before = new Set(await tokenIds(gm));
  await addCreature(gm, { bundledRef: 'goblin' });
  const ownedId = (await tokenIds(gm)).find((id) => !before.has(id))!;

  await openActivity(gm, 'encounter');
  const partyId = await promoteBin(gm, 'The Party');
  const seatRow = (name: string) =>
    gm.getByTestId(`group-card-${partyId}`).locator('li').filter({ hasText: name });
  await seatRow('Owner').getByRole('checkbox').check();
  await expect(seatRow('Outsider').getByRole('checkbox')).not.toBeChecked();

  await openActivity(gm, 'map');
  await addCreature(gm, { bundledRef: 'goblin' });
  const sceneryId = (await tokenIds(gm)).find((id) => !before.has(id) && id !== ownedId)!;

  /** Attempts to drag `tokenId` 80px down-right on `page`'s map; returns its
   * position readout before and after, so the caller can assert either way. */
  async function tryDrag(page: Page, tokenId: string): Promise<{ before: string; after: string }> {
    await openActivity(page, 'map');
    const readout = page.getByTestId(`token-pos-${tokenId}`);
    const beforePos = (await readout.textContent())!;
    const [x, y] = beforePos.split(',').map(Number);
    await dragCanvas(page, VECTOR_CANVAS, { x: x!, y: y! }, { x: x! + 80, y: y! + 80 });
    const after = (await readout.textContent())!;
    return { before: beforePos, after };
  }

  // The owning seat may drag the grouped creature; the outsider may not — the
  // token stays put, exactly the read-only outcome the sheet already gives.
  const outsiderAttempt = await tryDrag(outsider, ownedId);
  expect(outsiderAttempt.after).toBe(outsiderAttempt.before);

  const ownerAttempt = await tryDrag(owner, ownedId);
  expect(ownerAttempt.after).not.toBe(ownerAttempt.before);

  // The ungrouped, seatless creature is referee-only: a normal seat cannot
  // move it, the referee can.
  const sceneryOutsiderAttempt = await tryDrag(outsider, sceneryId);
  expect(sceneryOutsiderAttempt.after).toBe(sceneryOutsiderAttempt.before);

  const sceneryGmAttempt = await tryDrag(gm, sceneryId);
  expect(sceneryGmAttempt.after).not.toBe(sceneryGmAttempt.before);

  await gmContext.close();
  await ownerContext.close();
  await outsiderContext.close();
});
