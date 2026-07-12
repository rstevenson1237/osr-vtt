import { expect, type Page, test } from '@playwright/test';
import { openActivity, roomIdFromUrl } from './helpers';

// Run under prefers-reduced-motion — the 3D tumble is decorative; the
// authoritative readout is the (tinted, per-seat) result chip every client
// re-derives from the same seed (Master Plan v2, R3.6.4), same rationale as
// dice-overlay.spec.ts / dice-profiles.spec.ts.
test.use({ reducedMotion: 'reduce' });

/**
 * Shared rolls acceptance test (Master Plan v2, R3.6 / Gate 4b). Three
 * independent browser contexts against the real Firebase Emulator Suite:
 *  - Two players stage different dice in the Dice activity; the referee
 *    presses one Roll; every context (including a third, passive one) shows
 *    both dice landing simultaneously with identical values.
 *  - "Apply results to initiative": a Side-mode shared roll opened from the
 *    Encounter tracker, staged for two groups, fills the tracker's init
 *    values on an explicit tap.
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
  await expect(page.getByTestId('room-name')).toBeVisible();
}

test('two players stage different dice; the GM rolls once; every context lands identical simultaneous values', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const p1Context = await browser.newContext();
  const p2Context = await browser.newContext();
  const gm = await gmContext.newPage();
  const p1 = await p1Context.newPage();
  const p2 = await p2Context.newPage();

  const roomId = await createRoomAndJoin(gm, 'The Reckoning', 'Referee');
  await joinRoom(p1, roomId, 'Alice');
  await joinRoom(p2, roomId, 'Bob');

  await openActivity(gm, 'dice');
  await openActivity(p1, 'dice');
  await openActivity(p2, 'dice');

  // --- Referee opens a shared roll from the Dice activity ---
  await gm.getByTestId('shared-roll-open-label').fill('Reflex save');
  await gm.getByTestId('shared-roll-open-button').click();
  await expect(gm.getByTestId('shared-roll-panel')).toBeVisible();
  await expect(p1.getByTestId('shared-roll-panel')).toBeVisible();
  await expect(p2.getByTestId('shared-roll-panel')).toBeVisible();

  // --- Alice stages a d20, Bob stages a d12 — different dice per seat ---
  await p1.getByTestId('shared-roll-die-select').selectOption('d20');
  await p1.getByTestId('shared-roll-ready').check();

  await p2.getByTestId('shared-roll-die-select').selectOption('d12');
  await p2.getByTestId('shared-roll-ready').check();

  // The referee sees both seats flip ready live.
  await expect(gm.locator('[data-testid^="shared-roll-readiness-"].ready')).toHaveCount(2);

  // --- One Roll press resolves every staged, ready seat at once ---
  await gm.getByTestId('shared-roll-roll-button').click();

  // The staging panel closes (resolved) everywhere once the roll lands.
  await expect(gm.getByTestId('shared-roll-panel')).toHaveCount(0);
  await expect(p1.getByTestId('shared-roll-panel')).toHaveCount(0);
  await expect(p2.getByTestId('shared-roll-panel')).toHaveCount(0);

  // --- Every context (including the passive GM tab) shows both dice landing
  // simultaneously with identical values — the seed-authoritative invariant. ---
  for (const page of [gm, p1, p2]) {
    await expect(page.getByTestId('shared-roll-parts')).toBeVisible();
    await expect(page.locator('[data-testid^="shared-roll-part-"]')).toHaveCount(2);
  }
  const gmTotals = await gm.locator('[data-testid^="shared-roll-total-"]').allTextContents();
  const p1Totals = await p1.locator('[data-testid^="shared-roll-total-"]').allTextContents();
  const p2Totals = await p2.locator('[data-testid^="shared-roll-total-"]').allTextContents();
  expect(gmTotals).toHaveLength(2);
  expect(p1Totals).toEqual(gmTotals);
  expect(p2Totals).toEqual(gmTotals);

  // --- The grouped log entry lands once, with both seats' names ---
  await openActivity(gm, 'log');
  const entry = gm.locator('[data-testid="log-entry"]', { hasText: 'Reflex save' });
  await expect(entry).toContainText('Alice');
  await expect(entry).toContainText('Bob');

  await gmContext.close();
  await p1Context.close();
  await p2Context.close();
});

test('apply results to initiative fills the tracker rows (side mode)', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gm = await gmContext.newPage();
  await createRoomAndJoin(gm, 'The Sundered Gate', 'Referee');

  // --- A minimal Side-mode encounter: Party and Monsters, both [Active] ---
  await openActivity(gm, 'encounter');

  await gm.getByTestId('new-group-name').fill('Party');
  await gm.getByTestId('create-group-submit').click();
  await gm.getByTestId('new-group-name').fill('Monsters');
  await gm.getByTestId('create-group-submit').click();

  const partyRow = gm.locator('[data-testid^="group-row-"]', { hasText: 'Party' });
  const monstersRow = gm.locator('[data-testid^="group-row-"]', { hasText: 'Monsters' });
  const partyId = (await partyRow.getAttribute('data-testid'))!.replace('group-row-', '');
  const monstersId = (await monstersRow.getAttribute('data-testid'))!.replace('group-row-', '');

  await gm.getByTestId(`group-toggle-active-${partyId}`).click();
  await gm.getByTestId(`group-toggle-active-${monstersId}`).click();

  await gm.getByTestId('combat-mode-side').check();
  await gm.getByTestId('combat-start').click();
  await expect(gm.getByTestId(`combat-row-${partyId}`)).toHaveCount(1);
  await expect(gm.getByTestId(`combat-row-${monstersId}`)).toHaveCount(1);
  // Rows start uninitiated.
  await expect(gm.getByTestId(`combat-init-input-${partyId}`)).toHaveValue('');
  await expect(gm.getByTestId(`combat-init-input-${monstersId}`)).toHaveValue('');

  // --- Referee opens a shared roll from the tracker, one slot per side ---
  await gm.getByTestId('shared-roll-tracker-open').click();
  await expect(gm.getByTestId('shared-roll-tracker-panel')).toBeVisible();

  await gm.getByTestId('shared-roll-add-slot-id').fill(partyId);
  await gm.getByTestId('shared-roll-add-slot-die').selectOption('d6');
  await gm.getByTestId('shared-roll-add-slot-button').click();

  await gm.getByTestId('shared-roll-add-slot-id').fill(monstersId);
  await gm.getByTestId('shared-roll-add-slot-die').selectOption('d6');
  await gm.getByTestId('shared-roll-add-slot-button').click();

  await expect(gm.getByTestId(`shared-roll-tracker-readiness-${partyId}`)).toBeVisible();
  await expect(gm.getByTestId(`shared-roll-tracker-readiness-${monstersId}`)).toBeVisible();

  await gm.getByTestId('shared-roll-tracker-roll-button').click();
  await expect(gm.getByTestId('shared-roll-tracker-panel')).toHaveCount(0);

  // --- Explicit tap routes the results onto the matching tracker rows ---
  await expect(gm.getByTestId('shared-roll-apply-initiative')).toBeVisible();
  await gm.getByTestId('shared-roll-apply-initiative').click();

  const partyInit = await gm.getByTestId(`combat-init-input-${partyId}`).inputValue();
  const monstersInit = await gm.getByTestId(`combat-init-input-${monstersId}`).inputValue();
  expect(Number(partyInit)).toBeGreaterThanOrEqual(1);
  expect(Number(partyInit)).toBeLessThanOrEqual(6);
  expect(Number(monstersInit)).toBeGreaterThanOrEqual(1);
  expect(Number(monstersInit)).toBeLessThanOrEqual(6);

  await gmContext.close();
});
