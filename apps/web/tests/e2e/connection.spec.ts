import { expect, type Page, test } from '@playwright/test';
import { roomIdFromUrl, signInAsReferee } from './helpers';

/**
 * SPEC-058 §2 (WI-201, DEC-121, supersedes DEC-110/WI-186 — the reverted
 * persistent-cache attempt, IN-219). The Firebase Emulator Suite has no way
 * to drop just one browser context's connection, so this drives `RoomShell`'s
 * dev-only override (`window.__setConnectionOverride`, SPEC-058 §3) rather
 * than an actual network failure — the override feeds the same
 * `ConnectionDebounce` a real `subscribeConnection` reading would.
 *
 * The local build's guarantee (`MemoryStore`/`LocalStore` never report
 * disconnected, RULE-009) is proved at the contract-suite level instead of
 * here: this repo has no Playwright project that drives a local-build dev
 * server (`vite build --mode local-build` is a static build, not a dev
 * server), so there is nothing for a local-build e2e spec to run against.
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

async function setConnectionOverride(page: Page, value: boolean | null): Promise<void> {
  await page.evaluate((v) => {
    (
      window as unknown as { __setConnectionOverride?: (value: boolean | null) => void }
    ).__setConnectionOverride?.(v);
  }, value);
}

test('SPEC-058 §2: a disconnected room banners and locks the shell after the debounce, and unlocks immediately on reconnect', async ({
  page,
}) => {
  await createRoomAndJoin(page, 'The Silent Keep');

  await expect(page.getByTestId('connection-banner')).toHaveCount(0);
  await expect(page.getByTestId('room-content')).not.toHaveAttribute('inert');

  await setConnectionOverride(page, false);

  // Still inside the 2s debounce window (SPEC-058 §2): no banner yet, the
  // shell still takes input — a blip must never lock the room.
  await page.waitForTimeout(500);
  await expect(page.getByTestId('connection-banner')).toHaveCount(0);
  await expect(page.getByTestId('room-content')).not.toHaveAttribute('inert');

  await expect(page.getByTestId('connection-banner')).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId('connection-banner')).toContainText('Disconnected');
  await expect(page.getByTestId('room-content')).toHaveAttribute('inert');

  // The global keyboard handler returns early while disconnected (SPEC-058
  // §2, `onGlobalKey`) — "?" would otherwise always open the shortcut sheet
  // (asserted, connected, in shell-navigation.spec.ts).
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0);

  // The lobby link inside the banner is the one thing still reachable.
  await expect(page.getByTestId('connection-banner-lobby')).toBeVisible();

  await setConnectionOverride(page, true);

  // Reconnect ends the lock immediately — no debounce on the way back up.
  await expect(page.getByTestId('connection-banner')).toHaveCount(0);
  await expect(page.getByTestId('room-content')).not.toHaveAttribute('inert');
  await page.keyboard.press('?');
  await expect(page.getByTestId('shortcut-sheet')).toBeVisible();
});
