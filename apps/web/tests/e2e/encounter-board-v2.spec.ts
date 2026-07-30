import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import {
  addCreature,
  BOARD_CARD,
  claimOwnToken,
  dragCanvas,
  openActivity,
  roomIdFromUrl,
} from './helpers';

/**
 * Encounter Board v2 acceptance (Master Plan v2, R8 — Gate 8). Two independent
 * browser contexts against the real Firebase Emulator Suite:
 *  1. Pinned fields: the GM pins a profile-template field; it appears as a
 *     read-only `label: value` row on the actor card for BOTH clients.
 *  2. Collapse → drag → expand: a 3-token group folds to one stacked token
 *     (count bubble) on the Map for both clients; dragging it moves every
 *     member, and expanding leaves the formation's relative positions intact
 *     on both clients.
 *  3. Batch move: the collapsed-group drag lands all three members in one
 *     logical write burst (`moveTokens`), surfaced as `last-batch-move-count`.
 */

async function createRoomAndJoin(
  page: Page,
  roomName: string,
  displayName: string,
): Promise<string> {
  await page.goto('/');
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
}

/** All tokens on the Map as { id, x, y }, sorted left-to-right, read from the
 * hidden `token-pos-*` readouts (they reflect the stored positions even for a
 * collapsed group's hidden members). */
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

test('pinning a template field surfaces it read-only on the actor card for both clients', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Pinned Vault', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Pinned Vault');

  // The player claims a token from their own character sheet, which is what
  // links it to their Profile now that the referee's Actor Ownership panel is
  // gone (pinned rows only render on an owner-linked card).
  const tokenId = await claimOwnToken(player);

  await openActivity(gm, 'encounter');
  await openActivity(player, 'encounter');
  await expect(gm.getByTestId(`board-token-${tokenId}`)).toBeVisible();

  // No field is pinned yet, so no pinned row shows on either client.
  await expect(gm.getByTestId(`board-pinned-${tokenId}-torches`)).toHaveCount(0);
  await expect(player.getByTestId(`board-pinned-${tokenId}-torches`)).toHaveCount(0);

  // GM pins the "Torches" field (default value 3) from the Session template
  // editor, then returns to the board.
  await openActivity(gm, 'session');
  await gm.getByTestId('template-field-pin-torches').click();
  await openActivity(gm, 'encounter');

  // The pinned row now renders read-only on the card for BOTH clients.
  const gmRow = gm.getByTestId(`board-pinned-${tokenId}-torches`);
  const playerRow = player.getByTestId(`board-pinned-${tokenId}-torches`);
  await expect(gmRow).toBeVisible();
  await expect(gmRow).toContainText('Torches');
  await expect(gmRow).toContainText('3');
  await expect(playerRow).toBeVisible();
  await expect(playerRow).toContainText('Torches');
  await expect(playerRow).toContainText('3');

  await gmContext.close();
  await playerContext.close();
});

test('a collapsed 3-token group drags as one batch and expands with its formation intact on both clients', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  const roomId = await createRoomAndJoin(gm, 'Collapsing Warren', 'Referee');
  await joinRoom(player, roomId, 'Player One');
  await expect(player.getByTestId('room-name')).toHaveText('Collapsing Warren');

  // --- GM adds 3 goblins in one Add-creature flow, grouped automatically
  // (Master Plan v2, R7.3 / Gate 9) — steps each one cell to the right, same
  // placement as the old debug button. ---
  await addCreature(gm, { count: 3, bundledRef: 'goblin', groupName: 'Goblins' });
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(3);

  const initial = await readTokens(gm);
  const [a, b, c] = initial; // sorted left-to-right; `a` becomes the anchor
  const offAB = { x: b!.x - a!.x, y: b!.y - a!.y };
  const offAC = { x: c!.x - a!.x, y: c!.y - a!.y };

  // --- The Add-creature flow already grouped the three; reveal that group
  // on the Map so the player sees it ---
  await openActivity(gm, 'encounter');
  // The group's own card in its box carries the [Map]/[Board]/[Active] and
  // collapse controls (the separate Groups roster is gone).
  const groupBox = gm.locator('[data-testid^="cast-section-"]', {
    has: gm.locator('h3', { hasText: 'Goblins' }),
  });
  const groupTestId = await groupBox.getAttribute('data-testid');
  if (!groupTestId) throw new Error('Could not find the auto-created "Goblins" cast box');
  const groupId = groupTestId.replace('cast-section-', '');
  await gm.getByTestId(`group-toggle-map-${groupId}`).click();

  // --- Collapse the group to one stacked token ---
  await gm.getByTestId(`group-toggle-collapsed-${groupId}`).click();

  // Both clients render the collapsed group as a single count of 3 on the Map.
  await openActivity(gm, 'map');
  await openActivity(player, 'map');
  await expect(gm.getByTestId(`collapsed-group-${groupId}`)).toHaveText('3');
  await expect(player.getByTestId(`collapsed-group-${groupId}`)).toHaveText('3');

  // --- Drag the collapsed anchor token; every member moves in one batch ---
  await dragCanvas(
    gm,
    '[data-testid="vector-map-canvas"] canvas',
    { x: a!.x, y: a!.y },
    { x: a!.x + 60, y: a!.y + 180 },
  );

  // The drag committed exactly one write burst covering all three members.
  await expect(gm.getByTestId('last-batch-move-count')).toHaveText('3');

  // The anchor actually moved (so this is a real drag, not a no-op).
  await expect(gm.locator(`[data-testid="token-pos-${a!.id}"]`)).not.toHaveText(`${a!.x},${a!.y}`);

  // --- Relative positions preserved on BOTH clients ---
  async function expectFormationIntact(page: Page): Promise<void> {
    const moved = await readTokens(page);
    const anchor = moved.find((t) => t.id === a!.id)!;
    const mb = moved.find((t) => t.id === b!.id)!;
    const mc = moved.find((t) => t.id === c!.id)!;
    expect({ x: mb.x - anchor.x, y: mb.y - anchor.y }).toEqual(offAB);
    expect({ x: mc.x - anchor.x, y: mc.y - anchor.y }).toEqual(offAC);
  }

  // Wait for the player to receive the batched positions before asserting.
  await expect
    .poll(async () => {
      const moved = await readTokens(player);
      const anchor = moved.find((t) => t.id === a!.id);
      return anchor && anchor.x !== a!.x ? 'moved' : 'pending';
    })
    .toBe('moved');
  await expectFormationIntact(gm);
  await expectFormationIntact(player);

  // --- Expand: the collapsed count disappears and the formation stays put ---
  await openActivity(gm, 'encounter');
  await gm.getByTestId(`group-toggle-collapsed-${groupId}`).click();
  await openActivity(gm, 'map');
  await expect(gm.getByTestId(`collapsed-group-${groupId}`)).toHaveCount(0);
  await expect(player.getByTestId(`collapsed-group-${groupId}`)).toHaveCount(0);
  await expectFormationIntact(gm);
  await expectFormationIntact(player);

  await gmContext.close();
  await playerContext.close();
});

/**
 * An actor card. The bare `board-token-` prefix is NOT usable here: each card
 * also renders a `board-token-pos-{id}` span inside itself, so a prefix match
 * counts every card twice.
 */
// Shared with `helpers.ts` so the two cannot drift: the `board-token-` prefix
// also matches spans *inside* each card.
const CARD = BOARD_CARD;

test('cast boxes: naming the Unassigned bin promotes it, and cards drag between boxes', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Salt Barrow', 'Referee');

  // Two loose creatures, both in the Unassigned bin. Added one at a time on
  // purpose: the token picker auto-names a group whenever the count is 2 or
  // more, so a single count-2 add would land them in a group already.
  await addCreature(page);
  await addCreature(page);
  await openActivity(page, 'encounter');

  const unassigned = page.getByTestId('cast-section-unassigned');
  await expect(unassigned).toBeVisible();
  await expect(page.getByTestId('cast-count-unassigned')).toHaveText('2');

  // Double-clicking the bin's name is how a group gets made: the loose cards
  // move into it, and an empty Unassigned bin takes its place immediately.
  await unassigned.locator('h3').dblclick();
  await page.getByTestId('group-name-input-unassigned').fill('Cultists');
  await page.keyboard.press('Enter');

  // Match the section by its *heading*, not by page text — a box's own contents
  // (the group card's player checkboxes, a card's name) can carry the same
  // words as another group's heading.
  const sectionNamed = (name: string) =>
    page
      .locator('[data-testid^="cast-section-"]')
      .filter({ has: page.locator('h3', { hasText: name }) });

  const cultists = sectionNamed('Cultists');
  await expect(cultists).toHaveCount(1);
  await expect(cultists.locator(CARD)).toHaveCount(2);
  await expect(unassigned).toBeVisible();
  await expect(page.getByTestId('cast-count-unassigned')).toHaveText('0');

  // Renaming a real group is a plain patch, and it survives a reload.
  await cultists.locator('h3').dblclick();
  const renameInput = page.locator('[data-testid^="group-name-input-"]');
  await renameInput.fill('Acolytes');
  await renameInput.blur();
  await expect(sectionNamed('Acolytes')).toHaveCount(1);
  await page.reload();
  await openActivity(page, 'encounter');
  await expect(sectionNamed('Acolytes')).toHaveCount(1);

  // Escape abandons an edit rather than committing it.
  const acolytes = sectionNamed('Acolytes');
  await acolytes.locator('h3').dblclick();
  await page.locator('[data-testid^="group-name-input-"]').fill('Discarded');
  await page.keyboard.press('Escape');
  await expect(sectionNamed('Acolytes')).toHaveCount(1);
  await expect(sectionNamed('Discarded')).toHaveCount(0);

  // Dragging a card onto the Unassigned bin pulls it out of every group.
  const firstCard = acolytes.locator(CARD).first();
  const movedId = (await firstCard.getAttribute('data-testid'))!;
  await firstCard.dragTo(page.getByTestId('cast-section-unassigned'));
  await expect(page.getByTestId('cast-count-unassigned')).toHaveText('1');
  await expect(acolytes.locator(`[data-testid="${movedId}"]`)).toHaveCount(0);

  // …and dragging it back into the group returns it.
  await page.getByTestId(movedId).dragTo(acolytes);
  await expect(page.getByTestId('cast-count-unassigned')).toHaveText('0');
  await expect(acolytes.locator(CARD)).toHaveCount(2);
});

test('the group card carries the group flags and deletes the group with its cast', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Salt Barrow', 'Referee');
  await addCreature(page);
  await openActivity(page, 'encounter');

  const sectionNamed = (name: string) =>
    page
      .locator('[data-testid^="cast-section-"]')
      .filter({ has: page.locator('h3', { hasText: name }) });

  // Promoting the bin is the only way to make a group — `+ New group` went with
  // the per-card assign dropdown, since renaming the bin already creates one
  // out of cards that exist.
  const unassigned = page.getByTestId('cast-section-unassigned');
  await unassigned.locator('h3').dblclick();
  const rename = page.getByTestId('group-name-input-unassigned');
  await rename.fill('Ghouls');
  await rename.press('Enter');

  const ghouls = sectionNamed('Ghouls');
  await expect(ghouls).toHaveCount(1);
  await expect(ghouls.locator(CARD)).toHaveCount(1);

  const boxTestId = (await ghouls.getAttribute('data-testid'))!;
  const groupId = boxTestId.replace('cast-section-', '');
  const groupCard = page.getByTestId(`group-card-${groupId}`);
  await expect(groupCard).toBeVisible();
  // The group card sits to the *left* of the cards it governs — same box, one
  // row — so it precedes them in document order and shares their top edge.
  const cardBox = (await groupCard.boundingBox())!;
  const memberBox = (await ghouls.locator(CARD).first().boundingBox())!;
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(memberBox.x + 1);

  const board = page.getByTestId(`group-toggle-board-${groupId}`);
  await expect(board).toHaveClass(/active/); // promote keeps loose cards visible
  await board.click();
  await expect(board).not.toHaveClass(/active/);
  await board.click();

  // The retired controls are gone for good.
  await expect(page.getByTestId('cast-add-group')).toHaveCount(0);
  await expect(page.locator('[data-testid^="board-assign-"]')).toHaveCount(0);

  const tokenTestId = (await ghouls.locator(CARD).first().getAttribute('data-testid'))!;
  await expect(page.getByTestId(`group-toggle-collapsed-${groupId}`)).toBeEnabled();

  // Emptied out, a real group still renders for the referee — otherwise its
  // card, and with it Expand and Delete, would have nowhere to live. Collapse
  // is offered but inert with no members.
  await page.getByTestId(tokenTestId).dragTo(page.getByTestId('cast-section-unassigned'));
  await expect(ghouls.locator(CARD)).toHaveCount(0);
  await expect(groupCard).toBeVisible();
  await expect(page.getByTestId(`group-toggle-collapsed-${groupId}`)).toBeDisabled();

  // Drag it back in, and the card the group card sits beside is the cast again.
  await page.getByTestId(tokenTestId).dragTo(ghouls);
  await expect(ghouls.locator(CARD)).toHaveCount(1);
  await expect(page.getByTestId(`group-toggle-collapsed-${groupId}`)).toBeEnabled();

  // Delete takes the cast with it — confirmed first, and cancelling is a no-op.
  await page.getByTestId(`group-delete-${groupId}`).click();
  await page.getByTestId('confirm-dialog-cancel').click();
  await expect(ghouls).toHaveCount(1);

  await page.getByTestId(`group-delete-${groupId}`).click();
  await page.getByTestId('confirm-dialog-confirm').click();
  await expect(sectionNamed('Ghouls')).toHaveCount(0);
  // The token is gone outright, not returned to the Unassigned bin.
  await expect(page.getByTestId(tokenTestId)).toHaveCount(0);
  await expect(page.getByTestId('cast-count-unassigned')).toHaveText('0');
});
