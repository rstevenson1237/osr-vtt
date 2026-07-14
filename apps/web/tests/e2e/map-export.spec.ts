import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { openActivity, roomIdFromUrl } from './helpers';

/**
 * Master Plan v2, R9.8 / Gate 11: "GM and player exports decode as PNGs;
 * player export excludes hidden/fogged content (pixel-compare or
 * hidden-layer marker test)." Two independent browser contexts against the
 * real Firebase Emulator Suite: a room is carved but never swept of fog
 * (manual mode), so the whole carved room stays hidden from the player. Both
 * roles download a PNG via the Map toolbar's "Download PNG" button; the
 * bytes are decoded with a small dependency-free PNG decoder (proving they
 * really are decodable PNGs of nonzero size) and pixel-compared, proving the
 * player's export masks what the GM's doesn't.
 */

const CELL = 70; // Room.grid.cellSize default (DEFAULT_GRID_CONFIG)
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface DecodedPng {
  width: number;
  height: number;
  pixels: Buffer;
}

/** Minimal PNG decoder (8-bit RGB/RGBA, no interlacing) — enough to prove a
 * downloaded blob is a genuine, decodable PNG and to pixel-compare two
 * exports of the same frame, without pulling in an image-decoding
 * dependency for a single test. */
function decodePng(buf: Buffer): DecodedPng {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('Not a PNG (bad signature)');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 8 + len + 4; // length + type + data + crc
  }
  if (width === 0 || height === 0) throw new Error('Not a PNG (missing/empty IHDR)');
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : null;
  if (!bpp) throw new Error(`Unsupported PNG color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };
  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset]!;
    rawOffset += 1;
    const rowStart = y * stride;
    const prevRowStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rawOffset + x]!;
      const a = x >= bpp ? pixels[rowStart + x - bpp]! : 0;
      const b = y > 0 ? pixels[prevRowStart + x]! : 0;
      const c = y > 0 && x >= bpp ? pixels[prevRowStart + x - bpp]! : 0;
      let value: number;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = (rawByte + a) & 0xff;
          break;
        case 2:
          value = (rawByte + b) & 0xff;
          break;
        case 3:
          value = (rawByte + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4:
          value = (rawByte + paeth(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      pixels[rowStart + x] = value;
    }
    rawOffset += stride;
  }
  return { width, height, pixels };
}

/** Clicks the toolbar's export button and returns the downloaded file's raw
 * bytes — the real download path (object-URL `<a download>` click), not a
 * shortcut around it. */
async function downloadMapPng(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('map-export-png').click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error('Download produced no local path');
  return readFileSync(path);
}

test('map PNG export decodes for both roles; a player export of a fogged map differs from the GM', async ({
  browser,
}) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gm = await gmContext.newPage();
  const player = await playerContext.newPage();

  await gm.goto('/');
  await gm.getByTestId('create-room-name').fill('The Sunless Vault');
  await gm.getByTestId('create-room-submit').click();
  await gm.waitForURL(/#\/r\//);
  const roomId = roomIdFromUrl(gm.url());
  await gm.getByTestId('join-display-name').fill('Referee');
  await gm.getByTestId('join-submit').click();
  await expect(gm.getByTestId('my-role')).toHaveText('gm');

  await player.goto(`/#/r/${roomId}`);
  await player.getByTestId('join-display-name').fill('Player One');
  await player.getByTestId('join-submit').click();
  await expect(player.getByTestId('my-role')).toHaveText('player');

  // Manual fog: carved cells start hidden until swept, so an un-swept room
  // stays fogged for the player for the rest of this test.
  await openActivity(gm, 'session');
  await gm.getByTestId('fog-mode-select').selectOption('manual');
  await expect(player.getByTestId('fog-mode')).toHaveText('manual');
  await openActivity(gm, 'map');
  await openActivity(player, 'map');

  const gmCanvas = gm.locator('[data-testid="map-canvas"] canvas');
  const box = await gmCanvas.boundingBox();
  if (!box) throw new Error('GM canvas not found/visible');

  await gm.getByTestId('map-tool-carve').click();
  await gm.mouse.move(box.x + 100, box.y + 100);
  await gm.mouse.down();
  await gm.mouse.move(box.x + 100 + CELL * 3, box.y + 100 + CELL * 2, { steps: 8 });
  await gm.mouse.up();
  const carvedCount = await gm.getByTestId('floor-cell-count').textContent();
  expect(Number(carvedCount)).toBeGreaterThan(0);
  await expect(player.getByTestId('floor-cell-count')).toHaveText(carvedCount ?? '');
  // Nothing has been swept, so every carved cell is still fogged for the player.
  await expect(player.getByTestId('revealed-count')).toHaveText('0');

  const gmBytes = await downloadMapPng(gm);
  const playerBytes = await downloadMapPng(player);

  expect(gmBytes.length).toBeGreaterThan(0);
  expect(playerBytes.length).toBeGreaterThan(0);

  // Both decode as real PNGs (signature + a successful zlib inflate of the
  // IDAT stream — a corrupt/incomplete file throws here).
  const gmImage = decodePng(gmBytes);
  const playerImage = decodePng(playerBytes);
  expect(gmImage.width).toBeGreaterThan(0);
  expect(gmImage.height).toBeGreaterThan(0);
  expect(playerImage.width).toBe(gmImage.width);
  expect(playerImage.height).toBe(gmImage.height);

  // Pixel-compare (Gate 11): the player's export masks the un-swept floor
  // with fog, so a large share of pixels differ from the GM's full view.
  let differing = 0;
  for (let i = 0; i < gmImage.pixels.length; i++) {
    if (gmImage.pixels[i] !== playerImage.pixels[i]) differing++;
  }
  expect(differing).toBeGreaterThan(gmImage.pixels.length * 0.1);

  await gmContext.close();
  await playerContext.close();
});
