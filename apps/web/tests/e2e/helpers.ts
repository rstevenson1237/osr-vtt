import type { Page } from '@playwright/test';

export function roomIdFromUrl(url: string): string {
  const hash = new URL(url).hash; // "#/r/<roomId>"
  const match = /^#\/r\/([^/]+)/.exec(hash);
  if (!match?.[1]) throw new Error(`Could not extract roomId from URL: ${url}`);
  return decodeURIComponent(match[1]);
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
