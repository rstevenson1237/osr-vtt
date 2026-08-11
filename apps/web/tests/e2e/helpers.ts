import { expect, type Page } from '@playwright/test';

/**
 * Shell navigation (Master Plan v2, R1; restructured by the Shell UI Redesign).
 * The room UI is now a single full-screen main view (Map / Encounter / Assets)
 * plus independently toggled quick sheets and two modal overlays. This helper
 * keeps one call site for the specs and routes each legacy "activity" id to
 * wherever its panel now lives:
 *
 * - `map` / `encounter` / `assets` — the main-view tabs.
 * - `dice` → the Roll quick sheet, expanded (the full `DiceTray` only mounts in
 *   the expanded view, so `tray-*` / `roll-button` stay reachable).
 * - `characters` → the Character quick sheet, expanded.
 * - `log` / `session` → the Log and Session settings modals.
 *
 * Anything already open that would swallow the click (a backdrop) is dismissed
 * first, so consecutive calls behave the way they did against the old rail.
 */
export type ActivityId = 'map' | 'encounter' | 'dice' | 'characters' | 'log' | 'session' | 'assets';

export type QuickSheetName = 'maptools' | 'character' | 'roll' | 'room' | 'battle' | 'tables';

const SHEET_FOR: Partial<Record<ActivityId, QuickSheetName>> = {
  dice: 'roll',
  characters: 'character',
};

/** Closes an expanded quick sheet or an open Log/Session modal, if any. */
export async function dismissShellOverlays(page: Page): Promise<void> {
  const backdrop = page.locator('.sheet-backdrop, [data-testid="overlay-close"]');
  while ((await backdrop.count()) > 0) {
    await page.keyboard.press('Escape');
    await expect(backdrop).toHaveCount(0, { timeout: 2000 });
  }
}

/** Closes a quick sheet entirely (collapsing it first if it is expanded), so
 * the stage underneath is clickable again. */
export async function closeQuickSheet(page: Page, sheet: QuickSheetName): Promise<void> {
  await dismissShellOverlays(page);
  const card = page.getByTestId(`quick-sheet-${sheet}`);
  if ((await card.count()) === 0) return;
  await page.getByTestId(`quick-sheet-close-${sheet}`).click();
  await expect(card).toHaveCount(0);
}

/** Opens a quick sheet and expands it to its focused view — where the sheets
 * that only mount their heavyweight body when expanded (Roll's dice tray) and
 * the ones that only show their full content there (Room's whole list) become
 * assertable. */
export async function expandQuickSheet(page: Page, sheet: QuickSheetName): Promise<void> {
  await dismissShellOverlays(page);
  const toggle = page.getByTestId(`quick-sheet-toggle-${sheet}`);
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await page.getByTestId(`quick-sheet-expand-${sheet}`).click();
  await page.getByTestId(`quick-sheet-collapse-${sheet}`).waitFor({ state: 'visible' });
}

export async function openActivity(page: Page, id: ActivityId): Promise<void> {
  await dismissShellOverlays(page);

  if (id === 'log') {
    await page.getByTestId('log-open').click();
    await page.getByTestId('log-overlay').waitFor({ state: 'visible' });
    return;
  }

  if (id === 'session') {
    // The gear lives in the desktop Session tab and, on mobile, in the compact
    // top bar under its original bottom-bar testid.
    const desktop = page.getByTestId('session-shortcut');
    const mobile = page.getByTestId('mobile-activity-session');
    // Wait for one gear or the other to exist BEFORE choosing between them.
    // `count()` does not auto-wait, so calling it while the shell is still
    // mounting sees neither, silently concludes "mobile", and then hangs out
    // the whole test timeout waiting for a control this viewport never
    // renders. Same failure — and same fix — as `openActivityDrawer` below.
    await expect(desktop.or(mobile).first()).toBeVisible();
    const gear = (await desktop.count()) > 0 ? desktop : mobile;
    await gear.click();
    await page.getByTestId('session-overlay').waitFor({ state: 'visible' });
    return;
  }

  const sheet = SHEET_FOR[id];
  if (sheet) {
    await expandQuickSheet(page, sheet);
    return;
  }

  await openActivityDrawer(page);
  const tab = page.getByTestId(`activity-tab-${id}`);
  // Skip the click when the tab is already the active one. Re-clicking the
  // active tab is a no-op for the app but has intermittently hung in CI (the
  // click can't settle while the freshly-mounted map/Pixi stage is still
  // initializing) — and a real user never clicks the view they're already
  // on. Waiting on aria-selected also ensures the target view is actually
  // selected before we proceed.
  if ((await tab.getAttribute('aria-selected')) === 'true') {
    await closeActivityDrawer(page);
    return;
  }
  await tab.click();
}

/**
 * Reveals the main-view tabs. On desktop they live inside the rail's activity
 * drawer, which slides out on hover/click; on mobile they are the always-
 * visible bottom tab bar, so there is nothing to open.
 */
export async function openActivityDrawer(page: Page): Promise<void> {
  const mobileTabs = page.getByTestId('mobile-view-tabs');
  const trigger = page.getByTestId('activity-current');
  // Wait for the shell to have mounted one switcher or the other first.
  // `count()` does not auto-wait, so immediately after a `page.reload()` it
  // sees neither and a bare count check silently concludes "mobile" — then
  // the caller waits out its whole timeout for a tab nothing ever revealed.
  await expect(mobileTabs.or(trigger).first()).toBeVisible();
  if (await mobileTabs.isVisible()) return; // mobile: tabs are always on screen
  if ((await trigger.getAttribute('aria-expanded')) === 'true') return;
  await trigger.click();
  await page.getByTestId('activity-drawer').waitFor({ state: 'visible' });
}

/** Closes the activity drawer if it is pinned open. */
export async function closeActivityDrawer(page: Page): Promise<void> {
  const trigger = page.getByTestId('activity-current');
  if ((await trigger.count()) === 0) return;
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') return;
  await page.keyboard.press('Escape');
  await page.getByTestId('activity-drawer').waitFor({ state: 'hidden' });
}

export function roomIdFromUrl(url: string): string {
  const hash = new URL(url).hash; // "#/r/<roomId>"
  const match = /^#\/r\/([^/]+)/.exec(hash);
  if (!match?.[1]) throw new Error(`Could not extract roomId from URL: ${url}`);
  return decodeURIComponent(match[1]);
}

/**
 * GM "Add creature" flow (Master Plan v2, R7.3/WI-9) — replaces the old
 * debug "drop starter token" button. Opens the token picker (defaults to
 * the first Bundled ref), optionally sets a count, and confirms — the first
 * creature always lands at the map's `STARTER_DROP_POS` (160,160), same as
 * the old debug button, so tests anchored to that position still hold.
 */
export async function addCreature(
  page: Page,
  opts?: { count?: number; bundledRef?: string; groupName?: string },
): Promise<void> {
  // The button moved off the map stage into the *expanded* Map tools sheet,
  // so it no longer collides with the docked quick-sheet column.
  await expandQuickSheet(page, 'maptools');
  await page.getByTestId('add-creature').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'visible' });
  if (opts?.bundledRef) {
    await page.getByTestId(`asset-option-bundled-${opts.bundledRef}`).click();
  }
  if (opts?.count) {
    await page.getByTestId('token-picker-count').fill(String(opts.count));
  }
  if (opts?.groupName) {
    await page.getByTestId('token-picker-group-name').fill(opts.groupName);
  }
  await page.getByTestId('token-picker-confirm').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'detached' });
  await closeQuickSheet(page, 'maptools');
}

/** Every token id currently rendered on the map, from its `token-pos-*`
 * readouts. Caller must already be on the map activity. */
export async function tokenIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="token-pos-"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')!.replace('token-pos-', '')));
}

/**
 * Gives this seat a token linked to its own Profile, and returns the token id.
 *
 * This is the *only* way a token gets linked to a character now: the retired
 * GM-only Actor Ownership panel (`ownership-select-*`) went with the token
 * ownership model, so a character's token comes from the character sheet's own
 * "My token" action rather than from the referee assigning one.
 *
 * The caller drives whichever page owns the seat — a player links their own,
 * and the referee links theirs the same way.
 */
export async function claimOwnToken(page: Page): Promise<string> {
  // Must be on the map: the token readouts this diffs against are rendered by
  // `VectorMapView`, and "My token" creates the token wherever it is called.
  await openActivity(page, 'map');
  const before = new Set(await tokenIds(page));

  await expandQuickSheet(page, 'character');
  await page.getByTestId('my-token').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'visible' });
  await page.getByTestId('token-picker-confirm').click();
  await page.getByTestId('token-picker-dialog').waitFor({ state: 'detached' });
  await closeQuickSheet(page, 'character');

  await expect(page.locator('[data-testid^="token-pos-"]')).toHaveCount(before.size + 1);
  const added = (await tokenIds(page)).find((id) => !before.has(id));
  if (!added) throw new Error('No token appeared for the claimed character');
  return added;
}

/** The vector map editor's canvas selector (replaces the cellular `map-canvas`
 * after the WI-D hard cutover — `VectorMapView` is now the only map view). */
export const VECTOR_CANVAS = '[data-testid="vector-map-canvas"] canvas';

/** Every map tool now lives in the Map tools quick sheet, which starts closed
 * on both layouts (the old always-expanded right Tools rail is gone). Opens it
 * if needed; no-ops when it is already open. */
export async function openMapToolSheet(page: Page): Promise<void> {
  await dismissShellOverlays(page);
  const toggle = page.getByTestId('quick-sheet-toggle-maptools');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await page.getByTestId('quick-sheet-maptools').waitFor({ state: 'visible' });
}

/**
 * Flips the per-viewer Edit/View soft lock to Edit (DEC-064: every session
 * now joins with the map in View, locking every carve/edit tool behind the
 * single `map-mode-toggle` button). A real referee or player flips it once
 * before touching the palette; specs that need the carve/edit tools do the
 * same, right after joining.
 */
export async function switchToEditMode(page: Page): Promise<void> {
  await openMapToolSheet(page);
  const toggle = page.getByTestId('map-mode-toggle');
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  await closeQuickSheet(page, 'maptools');
}

/**
 * Picks a map tool, then closes the Map tools sheet again.
 *
 * The sheet docks *over* the stage's top-left corner (a deliberate part of the
 * quick-sheet design — sheets layer over the main view rather than shrinking
 * it), so leaving it open would swallow pointer events for any canvas
 * interaction in that region. Tool selection lives on the shared
 * `MapToolController` and survives the sheet closing, exactly as it does for a
 * real user who picks a tool and then dismisses the sheet to get a clear
 * canvas. This keeps every spec's canvas coordinates valid.
 */
export async function selectMapTool(page: Page, toolTestId: string): Promise<void> {
  await openMapToolSheet(page);
  await page.getByTestId(toolTestId).click();
  await page.getByTestId('quick-sheet-close-maptools').click();
  await expect(page.getByTestId('quick-sheet-maptools')).toHaveCount(0);
}

/**
 * Arms the Capture tool (SPEC-029 §1) via the battle-map quick sheet's
 * "Capture area" button — `selectMapTool`'s counterpart for `capture`, which
 * DEC-066 moved off the Map tools palette entirely. Leaves the battle sheet
 * closed again so the drag that follows lands on a clear canvas.
 */
export async function armCaptureTool(page: Page): Promise<void> {
  await expandQuickSheet(page, 'battle');
  await page.getByTestId('vector-tool-capture').click();
  await closeQuickSheet(page, 'battle');
}

/**
 * Fog of war's on/off switch, which lives in Session settings (it is a per-map
 * session setting, not a drawing tool — the Map tools sheet keeps only the fog
 * *authoring* controls). Leaves the Session modal closed again.
 */
export async function setFogEnabled(page: Page, enabled: boolean): Promise<void> {
  await openActivity(page, 'session');
  const toggle = page.getByTestId('fog-enabled-toggle');
  if (enabled) await toggle.check();
  else await toggle.uncheck();
  await page.getByTestId('overlay-close').click();
  await page.getByTestId('session-overlay').waitFor({ state: 'hidden' });
  await expect(page.getByTestId('fog-enabled')).toHaveText(String(enabled));
}

/**
 * Picks a carve tool *and* what it carves — Floor/Rock carve the map, the two
 * fog modes point the same stroke at the fog layer (which is what replaced the
 * dedicated Reveal/Hide tools). Closes the sheet again like `selectMapTool`.
 */
export async function selectCarveMode(
  page: Page,
  toolTestId: string,
  mode: 'add' | 'subtract' | 'fog' | 'unfog',
): Promise<void> {
  await openMapToolSheet(page);
  await page.getByTestId(toolTestId).click();
  await page.getByTestId('carve-mode').selectOption(mode);
  await page.getByTestId('quick-sheet-close-maptools').click();
  await expect(page.getByTestId('quick-sheet-maptools')).toHaveCount(0);
}

/** Carves a rectangular floor region with the vector Room tool (the vector
 * successor to the cellular Carve tool). Returns after the drag settles. */
export async function vectorCarve(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await selectMapTool(page, 'vector-tool-room');
  await dragCanvas(page, VECTOR_CANVAS, from, to);
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

/**
 * Sets the room's initiative mode, which moved from the Combat Tracker's
 * radios into Session settings (the encounter/initiative/dice revamp §1) —
 * the tracker's radios rendered for players who could never commit them.
 *
 * Leaves the Session modal closed again so callers continue on the stage.
 */
export async function setInitiativeMode(
  page: Page,
  mode: 'free' | 'side' | 'individual',
): Promise<void> {
  await openActivity(page, 'session');
  await page.getByTestId(`session-initiative-mode-${mode}`).check();
  await page.getByTestId('overlay-close').click();
  await page.getByTestId('session-overlay').waitFor({ state: 'hidden' });
}

/**
 * The referee's staged initiative round: open the call, then resolve it.
 * Replaces the old `combat-start` + per-row `combat-roll-*` flow — the latter
 * was a bare `Math.random()` nobody but the referee ever saw.
 */
export async function callAndRollInitiative(page: Page): Promise<void> {
  await page.getByTestId('combat-call-initiative').click();
  await page.getByTestId('combat-roll-initiative').click();
}

/**
 * An actor card on the Encounter board.
 *
 * The `board-token-` prefix is shared by two *spans nested inside* each card
 * (`board-token-pos-{id}`, `board-token-hidden-{id}`), so a bare prefix match
 * returns three nodes per card. Selecting one of those spans and dragging it
 * still starts the card's own drag — silently moving a card you only meant to
 * enumerate — so every card query goes through this.
 */
export const BOARD_CARD =
  '[data-testid^="board-token-"]:not([data-testid^="board-token-pos-"]):not([data-testid^="board-token-hidden-"])';

/**
 * Creates an encounter group on the board and returns its id.
 *
 * The board has exactly one creation path now: renaming the Unassigned bin
 * promotes it into a real group holding whatever cards were loose. (`+ New
 * group`, which made an *empty* group, and the per-card `board-assign-*`
 * dropdown both went with the group-ownership change — membership is drag-and-
 * drop, full stop.) So this helper promotes the bin and then drags back out any
 * card the caller did not ask for, using the board's own DnD.
 *
 * That means every loose token must already exist before calling this, and the
 * bin is emptied by the promote — a second call in the same test creates a
 * group out of whatever has since become loose.
 *
 * The caller must already be on the Encounter board as the referee.
 */
export async function createGroup(
  page: Page,
  name: string,
  memberTokenIds: string[],
): Promise<string> {
  const bin = page.getByTestId('cast-section-unassigned');
  const loose = await bin
    .locator(BOARD_CARD)
    .evaluateAll((cards) =>
      cards.map((c) => c.getAttribute('data-testid')!.replace('board-token-', '')),
    );

  // Double-click the bin's heading to start the inline rename; committing it
  // creates the group with every loose card in it.
  await bin.locator('h3').dblclick();
  const rename = page.getByTestId('group-name-input-unassigned');
  await rename.fill(name);
  await rename.press('Enter');

  const box = page.locator('[data-testid^="cast-section-"]', {
    has: page.locator('h3', { hasText: name }),
  });
  await expect(box).toHaveCount(1);
  const testId = await box.getAttribute('data-testid');
  if (!testId) throw new Error(`Could not find cast box for "${name}"`);
  const groupId = testId.replace('cast-section-', '');

  // Everything loose came along; put back what wasn't asked for. The bin is
  // synthetic and always rendered for the referee, so an empty one is waiting.
  for (const tokenId of loose) {
    if (memberTokenIds.includes(tokenId)) continue;
    await page.getByTestId(`board-token-${tokenId}`).dragTo(bin);
  }
  return groupId;
}

// ---------------------------------------------------------------------------
// Referee identity for room creation (R24.1)
// ---------------------------------------------------------------------------

/**
 * Room creation requires a NON-ANONYMOUS sign-in provider (R24.1), so any spec
 * that creates a room must first give its page a real account. Joining is
 * untouched — a player still lands in a room with zero prompts, which is the
 * invariant Gate 10 pins — so only the creating page needs this.
 *
 * The app performs this with `linkWithPopup(GoogleAuthProvider)`, which the
 * Firebase SDK implements by loading `apis.google.com` — unreachable from a
 * headless/sandboxed runner, and not something a CI suite should depend on
 * regardless. So we do what `account-recovery.emulator.test.ts` does one layer
 * down: mint a real Google-provider session against the **Auth emulator's REST
 * API** (which never verifies the token signature), then hand it to the SDK
 * through its own IndexedDB persistence record.
 *
 * The result is a genuinely non-anonymous session issued by the emulator — the
 * `firebase.sign_in_provider` claim the create rule reads is real, not stubbed
 * — so this exercises the shipped rule rather than bypassing it. Nothing in
 * `apps/web/src` knows this helper exists.
 */

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
/** Matches `loadFirebaseEnv()`'s zero-setup demo config. */
const API_KEY = 'demo-api-key';

function fakeGoogleIdToken(sub: string, email: string): string {
  const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64url({ alg: 'none', type: 'JWT' })}.${b64url({ sub, email, email_verified: true })}.`;
}

interface EmulatorSession {
  localId: string;
  idToken: string;
  refreshToken: string;
  email: string;
  displayName: string;
  /** Carried into the page because a `page.evaluate` body cannot close over
   * module scope — everything it needs must arrive as its argument. Keeping it
   * on the session (rather than re-typing the literal inside the browser
   * callback) is what stops the persistence key and the REST call from silently
   * disagreeing if `API_KEY` ever changes. */
  apiKey: string;
}

/** Signs a fake Google identity in against the Auth emulator, over REST. */
async function mintGoogleSession(sub: string, email: string): Promise<EmulatorSession> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${fakeGoogleIdToken(sub, email)}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnSecureToken: true,
        returnIdpCredential: true,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Auth emulator signInWithIdp failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as Partial<EmulatorSession>;
  if (!body.localId || !body.idToken || !body.refreshToken) {
    throw new Error(`Auth emulator returned no session: ${JSON.stringify(body)}`);
  }
  return {
    localId: body.localId,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    email,
    displayName: body.displayName ?? 'Referee',
    apiKey: API_KEY,
  };
}

/**
 * Gives `page` a signed-in (non-anonymous) identity and leaves it on the Lobby
 * with the Create form available. Call INSTEAD of `page.goto('/')` in any spec
 * that creates a room.
 *
 * Seeds the SDK's own persistence record and then reloads, rather than racing
 * an init script against the app's bootstrap: the write is fully committed
 * before the page that reads it exists.
 */
export async function signInAsReferee(page: Page, label = 'referee'): Promise<string> {
  const unique = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const session = await mintGoogleSession(unique, `${unique}@example.com`);

  // Seed from a STATIC file on the app's origin, not from the app itself.
  //
  // IndexedDB is per-origin, so any same-origin document can write the record —
  // and this one runs no app JavaScript. That matters: loading `/` boots the
  // Lobby, whose `onMount` calls `ensureAuth()` → `signInAnonymously()` →
  // persist, writing the very record we are about to write. Seeding on top of
  // the app is therefore a race we lose intermittently (the anonymous write
  // lands after ours and the reload restores *it*), which is exactly how this
  // first shipped and exactly how it flaked. With no app on the page there is
  // no competing writer, and the subsequent `goto('/')` finds a session already
  // in place — `ensureAuth` sees a `currentUser` and never signs in anonymously
  // at all.
  const seed = async (): Promise<void> => {
    await page.goto('/assets/ATTRIBUTION.md');
    await page.evaluate(async (s) => {
      // NB: `value` is a plain OBJECT, not a JSON string — verified against what
      // the SDK itself writes. Stringifying it here fails silently: the record
      // lands, the SDK reads it back, cannot parse a user out of it, and quietly
      // falls back to a fresh anonymous sign-in.
      const record = {
        fbase_key: `firebase:authUser:${s.apiKey}:[DEFAULT]`,
        value: {
          uid: s.localId,
          email: s.email,
          emailVerified: true,
          displayName: s.displayName,
          isAnonymous: false,
          providerData: [
            {
              providerId: 'google.com',
              uid: s.localId,
              displayName: s.displayName,
              email: s.email,
              phoneNumber: null,
              photoURL: null,
            },
          ],
          stsTokenManager: {
            refreshToken: s.refreshToken,
            accessToken: s.idToken,
            expirationTime: Date.now() + 3600_000,
          },
          createdAt: String(Date.now()),
          lastLoginAt: String(Date.now()),
          apiKey: s.apiKey,
          appName: '[DEFAULT]',
        },
      };
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('firebaseLocalStorageDb', 1);
        open.onupgradeneeded = () =>
          open.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('firebaseLocalStorage', 'readwrite');
          tx.objectStore('firebaseLocalStorage').put(record);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    }, session);
    // Now load the app, which restores the seeded session on boot.
    await page.goto('/');
  };

  // One retry, purely defensive. The static-page seed removes the writer this
  // used to race, but a page that had *already* booted the app (the Gate 25
  // spec inspects the anonymous gate before signing in) can in principle still
  // have an anonymous persist in flight as we navigate away. Re-seeding is
  // cheap and idempotent; failing here would be an opaque "Create form never
  // appeared" in an unrelated spec.
  await seed();
  // The Create form only renders for a non-anonymous account (R24.1), so its
  // appearance IS the assertion that the identity took.
  const createForm = page.getByTestId('create-room-name');
  if (!(await createForm.isVisible().catch(() => false))) {
    await expect(createForm.or(page.getByTestId('create-room-signin-gate'))).toBeVisible({
      timeout: 15_000,
    });
    if (!(await createForm.isVisible().catch(() => false))) await seed();
  }
  await expect(createForm).toBeVisible({ timeout: 15_000 });
  return session.localId;
}
