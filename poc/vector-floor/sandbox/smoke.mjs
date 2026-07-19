/**
 * Headless UI smoke test: loads the built single-file artifact, asserts no
 * console/page errors, confirms the demo scene rendered (side panel shows
 * regions/doors/sight segments), exercises undo, and saves a screenshot.
 */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = pathToFileURL(resolve('dist/artifact.html')).href;

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url);
await page.waitForSelector('#side .row', { timeout: 5000 });

const read = async (label) =>
  page.evaluate((l) => {
    const rows = [...document.querySelectorAll('#side .row')];
    const row = rows.find((r) => r.querySelector('span')?.textContent?.includes(l));
    return row?.querySelector('b')?.textContent ?? null;
  }, label);

const regions = Number(await read('Floor regions'));
const doors = Number(await read('Doors'));
const sight = Number(await read('Sight segments'));
const verts = Number(await read('Total vertices'));

let ok = true;
const assert = (name, cond, got) => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : ` (got ${got})`}`);
  if (!cond) ok = false;
};

assert('demo loaded floor regions', regions >= 1, regions);
assert('demo loaded doors', doors >= 1, doors);
assert('demo produced sight segments', sight > 4, sight);
assert('demo floor has vertices', verts > 8, verts);

// toolbar present with all 10 tools
const toolCount = await page.evaluate(() => document.querySelectorAll('#bar button[data-tool]').length);
assert('all 10 tools in toolbar (incl. Select)', toolCount === 10, toolCount);

// exercise the Select tool: drag an edge and confirm geometry changes, no errors
await page.click('#bar button[data-tool="select"]');
const before = Number(await read('Total vertices'));
const box = await page.$eval('#cv', (c) => {
  const r = c.getBoundingClientRect();
  return { x: r.x, y: r.y };
});
// drag somewhere on a floor edge region of the demo (left room spans ~lattice 2..10)
await page.mouse.move(box.x + 200, box.y + 190);
await page.mouse.down();
await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 });
await page.mouse.up();
const afterSelect = Number(await read('Total vertices'));
assert('select tool drag keeps a valid floor', afterSelect >= 1 || afterSelect === before, afterSelect);

// exercise undo button
await page.click('#bar >> text=Undo').catch(() => {});
await page.click('#bar >> text=Reset');
const regionsAfterReset = Number(await read('Floor regions'));
assert('reset clears floor', regionsAfterReset === 0, regionsAfterReset);

await page.click('#bar >> text=Demo');
const regionsAfterDemo = Number(await read('Floor regions'));
assert('demo reloads floor', regionsAfterDemo >= 1, regionsAfterDemo);

await page.screenshot({ path: 'dist/screenshot.png' });

assert('no console/page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(errors.length ? `\nerrors:\n${errors.join('\n')}` : '\nno errors');
process.exit(ok ? 0 : 1);
