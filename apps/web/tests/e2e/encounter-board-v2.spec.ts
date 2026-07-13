import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { dragCanvas, openActivity, roomIdFromUrl } from './helpers';

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

async function createRoomAndJoin(page: Page, roomName: string, displayName: string): Promise<string> {
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

async function createGroup(page: Page, name: string, memberTokenIds: string[]): Promise<string> {
  const rows = page.locator('[data-testid^="group-row-"]');
  const before = await rows.count();
  await page.getByTestId('new-group-name').fill(name);
  for (const tokenId of memberTokenIds) {
    await page.getByTestId(`new-group-member-${tokenId}`).check();
  }
  await page.getByTestId('create-group-submit').click();
  await expect(rows).toHaveCount(before + 1);
  const row = page.locator('[data-testid^="group-row-"]', { hasText: name });
  const testId = await row.getAttribute('data-testid');
  if (!testId) throw new Error(`Could not find group row for "${name}"`);
  return testId.replace('group-row-', '');
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

  // GM drops a token and links it to the player's seat so the card resolves a
  // Profile (pinned rows only render on an owner-linked card).
  await gm.getByTestId('drop-token').click();
  const gmTokenPos = gm.locator('[data-testid^="token-pos-"]');
  await expect(gmTokenPos).toHaveCount(1);
  const tokenId = (await gmTokenPos.getAttribute('data-testid'))!.replace('token-pos-', '');

  await openActivity(gm, 'encounter');
  await openActivity(player, 'encounter');
  await gm.getByTestId(`ownership-select-${tokenId}`).selectOption({ label: 'Player One' });

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

  // --- GM drops three tokens at distinct cells (add-token steps each one
  // cell to the right) ---
  await gm.getByTestId('add-token').click();
  await gm.getByTestId('add-token').click();
  await gm.getByTestId('add-token').click();
  await expect(gm.locator('[data-testid^="token-pos-"]')).toHaveCount(3);

  const initial = await readTokens(gm);
  const [a, b, c] = initial; // sorted left-to-right; `a` becomes the anchor
  const offAB = { x: b!.x - a!.x, y: b!.y - a!.y };
  const offAC = { x: c!.x - a!.x, y: c!.y - a!.y };

  // --- Group all three and reveal the group on the Map so the player sees it ---
  await openActivity(gm, 'encounter');
  const groupId = await createGroup(gm, 'Goblins', [a!.id, b!.id, c!.id]);
  await gm.getByTestId(`group-toggle-map-${groupId}`).click();

  // --- Collapse the group to one stacked token ---
  await gm.getByTestId(`group-toggle-collapsed-${groupId}`).click();

  // Both clients render the collapsed group as a single count of 3 on the Map.
  await openActivity(gm, 'map');
  await openActivity(player, 'map');
  await expect(gm.getByTestId(`collapsed-group-${groupId}`)).toHaveText('3');
  await expect(player.getByTestId(`collapsed-group-${groupId}`)).toHaveText('3');

  // --- Drag the collapsed anchor token; every member moves in one batch ---
  await dragCanvas(gm, '[data-testid="map-canvas"] canvas', { x: a!.x, y: a!.y }, { x: a!.x + 60, y: a!.y + 180 });

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
