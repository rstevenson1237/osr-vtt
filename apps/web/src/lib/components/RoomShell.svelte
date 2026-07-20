<script lang="ts">
  import { getContext, onMount, onDestroy, setContext } from 'svelte';
  import {
    type CampaignStore,
    type Encounter,
    type GameMap,
    type Group,
    type LogEntry,
    type PlayerSeat,
    type ProfileInstance,
    type Roll,
    type Room,
    type Token,
    type Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY, SHELL_STATE_KEY } from '../context';
  import { roomShareUrl } from '../routes';
  import { applyTheme, resolveThemeName } from '../theme';
  import { MapToolController } from '../shell/map-tool-controller.svelte';
  import { ShellState } from '../shell/shell-state.svelte';
  import { DialogService } from '../shell/dialogs.svelte';
  import { activitiesFor, activityById, activityForDigit } from '../shell/activities';
  import type { ActivityDef } from '../shell/types';
  // Shell chrome
  import SessionTab from './shell/SessionTab.svelte';
  import ActivitiesRail from './shell/ActivitiesRail.svelte';
  import ToolsRail from './shell/ToolsRail.svelte';
  import LogRail from './shell/LogRail.svelte';
  import ShortcutSheet from './shell/ShortcutSheet.svelte';
  import PromptDialog from './shell/PromptDialog.svelte';
  import ConfirmDialog from './shell/ConfirmDialog.svelte';
  import TokenPickerDialog from './shell/TokenPickerDialog.svelte';
  import DiceMiniCard from './shell/DiceMiniCard.svelte';
  import CharactersMiniCard from './shell/CharactersMiniCard.svelte';
  // Mobile / tablet chrome (Master Plan v2, R1.8)
  import MobileTopBar from './shell/MobileTopBar.svelte';
  import MobileActivityBar from './shell/MobileActivityBar.svelte';
  import ToolSheet from './shell/ToolSheet.svelte';
  import { createLayoutMode } from '../shell/layout.svelte';
  import { focusChat } from '../log/chat-focus';
  // Stage activities (re-housed existing components)
  import VectorMapView from './VectorMapView.svelte';
  import EncounterBoard from './EncounterBoard.svelte';
  import HandoutViewer from './HandoutViewer.svelte';
  import CharacterDock from './CharacterDock.svelte';
  import DiceTray from './DiceTray.svelte';
  import DiceOverlay from './DiceOverlay.svelte';
  import SessionActivity from './shell/SessionActivity.svelte';
  import LogActivity from './shell/LogActivity.svelte';
  import AssetsActivity from './shell/AssetsActivity.svelte';

  let { roomId }: { roomId: string } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  // ---- shell context (Master Plan v2, R1) — one set per room instance
  // (RoomShell is keyed on roomId in App.svelte). ----
  // roomId is stable for this instance — RoomShell is keyed on it in App.svelte,
  // so reading it once at construction is correct (not a missed reactive dep).
  // eslint-disable-next-line svelte/valid-compile
  const shell = new ShellState(roomId);
  const mapCtrl = new MapToolController();
  const dialogs = new DialogService();
  setContext(SHELL_STATE_KEY, shell);
  setContext(MAP_TOOL_KEY, mapCtrl);
  setContext(DIALOG_KEY, dialogs);

  // Mobile / tablet layout (Master Plan v2, R1.8): < 900px or coarse pointer.
  const layout = createLayoutMode();
  const isMobile = $derived(layout.isMobile);

  let myUid = $state<string | null>(null);
  let room = $state<Room | null>(null);
  // The active `GameMap` (Master Plan v2, R17.3 — multiple full map builds per
  // session). Re-subscribed whenever `room.activeMapId` changes (the GM
  // switched maps) via the effect below; `null` while unresolved (map doc not
  // yet loaded, or a pre-v11 room whose `ensureActiveMap` adoption hasn't run
  // yet — see the effect below).
  let map = $state<GameMap | null>(null);
  let mapUnsub: Unsubscribe | null = null;
  let players = $state<PlayerSeat[]>([]);
  let tokens = $state<Token[]>([]);
  let profiles = $state<ProfileInstance[]>([]);
  let log = $state<LogEntry[]>([]);
  let rolls = $state<Roll[]>([]);
  let groups = $state<Group[]>([]);
  let encounter = $state<Encounter | null>(null);

  let joinName = $state('');
  let joining = $state(false);
  let joinError = $state('');
  let selectedSeatId = $state<string | null>(null);

  // Unread log badge (R1 — badge on the Log rail icon). Seeded to the current
  // length on first load so pre-join history isn't counted as unread.
  let logSeen = $state(0);
  let logInit = false;

  let unsubs: Unsubscribe[] = [];

  const me = $derived(players.find((p) => p.uid === myUid) ?? null);
  const hasJoined = $derived(me !== null);
  const isGM = $derived(room !== null && myUid !== null && room.gmUid === myUid);
  // The Dock shows whichever actor's card was last selected on the Encounter
  // Board (Spec §5), defaulting back to my own sheet.
  const dockSeatId = $derived(selectedSeatId ?? myUid ?? '');
  const dockProfile = $derived(profiles.find((p) => p.seatId === dockSeatId));
  const dockReadOnly = $derived(dockSeatId !== myUid && !isGM);
  const showBackToMine = $derived(dockSeatId !== (myUid ?? ''));

  const visibleActivities = $derived(activitiesFor(isGM));
  const activeDef = $derived(activityById(shell.activeActivity));
  const logUnread = $derived(Math.max(0, log.length - logSeen));

  // Shell frame sizing: rails collapse to slim strips (Gate 2 — ≥90% stage).
  // The Map and (GM-only) Encounter activities both publish a Tools rail
  // (R8.3 moves the referee chrome into the Encounter one); every other
  // activity leaves it a slim spine.
  const railHasTools = $derived(
    shell.activeActivity === 'map' || (shell.activeActivity === 'encounter' && isGM),
  );
  const rightWidth = $derived(railHasTools && !shell.toolsCollapsed ? 300 : 28);
  const bottomHeight = $derived(shell.drawerExpanded ? shell.drawerHeight : 34);

  onMount(async () => {
    myUid = await store.ensureAuth();
    unsubs.push(store.subscribeRoom(roomId, (r) => (room = r)));
    unsubs.push(store.subscribePlayers(roomId, (p) => (players = p)));
    unsubs.push(store.subscribeTokens(roomId, (t) => (tokens = t)));
    unsubs.push(store.subscribeProfiles(roomId, (p) => (profiles = p)));
    unsubs.push(
      store.subscribeLog(roomId, (l) => {
        log = l;
        if (!logInit) {
          logInit = true;
          logSeen = l.length;
        }
      }),
    );
    unsubs.push(store.subscribeRolls(roomId, (r) => (rolls = r)));
    unsubs.push(store.subscribeGroups(roomId, (g) => (groups = g)));
    unsubs.push(store.subscribeEncounter(roomId, (e) => (encounter = e)));
  });

  // Room-level theme (R2/R4) — GM-set, applied for every player.
  $effect(() => {
    if (room) applyTheme(resolveThemeName(room.settings.theme));
  });

  // Adopts a pre-v11 room's flat map data into its first `GameMap` (Master
  // Plan v2, R17.3's migration — see `CampaignStore.ensureActiveMap`).
  // GM-gated so two clients never race the adoption; idempotent either way,
  // so a stale/racing call from a slow-to-unmount previous GM session is
  // harmless. A no-op for every room created at schema v11+ (already has
  // `activeMapId` from `createRoom`).
  $effect(() => {
    if (room && isGM && !room.activeMapId) void store.ensureActiveMap(roomId);
  });

  // Re-subscribes to the active map whenever it changes (a fresh mount, or
  // the GM switching maps) — `MapView` itself is remounted on the same
  // change via its `{#key}` wrapper below, so its per-map subscriptions never
  // straddle two different `mapId`s.
  $effect(() => {
    const mapId = room?.activeMapId;
    mapUnsub?.();
    mapUnsub = null;
    map = null;
    if (!mapId) return;
    mapUnsub = store.subscribeMap(roomId, mapId, (m) => (map = m));
  });

  // A player must never land on the GM-only Session activity (e.g. a persisted
  // shell state from when they were GM, or a stale localStorage value).
  $effect(() => {
    if (room && !isGM && activeDef.availability === 'gm') shell.setActivity('map');
  });

  // Mark the log read while the Log activity is open or the drawer is expanded.
  $effect(() => {
    if (shell.activeActivity === 'log' || shell.drawerExpanded) logSeen = log.length;
  });

  onDestroy(() => {
    for (const unsub of unsubs) unsub();
    unsubs = [];
    mapUnsub?.();
    layout.dispose();
  });

  async function join() {
    if (!joinName.trim() || joining) return;
    joining = true;
    joinError = '';
    try {
      await store.joinRoom(roomId, joinName.trim());
    } catch (err) {
      joinError = err instanceof Error ? err.message : 'Failed to join room';
    } finally {
      joining = false;
    }
  }

  let linkCopied = $state(false);
  async function copyShareLink() {
    await navigator.clipboard.writeText(roomShareUrl(roomId));
    linkCopied = true;
    setTimeout(() => (linkCopied = false), 1500);
  }

  // The tool bottom-sheet only appears for activities that publish tools —
  // in WI-2/WI-3 that's the Map activity, once its engine has mounted.
  const activeHasTools = $derived(shell.activeActivity === 'map' && mapCtrl.mounted);

  // ---- shell interactions ----
  function onActivate(def: ActivityDef): void {
    // A mini-card only opens when its activity is not already the stage — this
    // guarantees the re-housed component (DiceTray / CharacterDock, which use
    // shared singleton state) is never mounted twice.
    if (def.hasMiniCard && shell.activeActivity !== def.id) shell.toggleFlyout(def.id);
    else shell.setActivity(def.id);
  }

  function isTypingTarget(el: EventTarget | null): boolean {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
  }

  function onGlobalKey(e: KeyboardEvent): void {
    // While a modal dialog / prompt / confirm is open, let it own the keyboard.
    if (shell.dialog || dialogs.prompt || dialogs.confirmRequest || dialogs.tokenPicker) return;
    if (e.key === 'Escape') {
      if (shell.flyout) {
        shell.closeFlyout();
        e.preventDefault();
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // reserve Ctrl+Z etc.
    if (e.key === '?') {
      shell.openShortcuts();
      e.preventDefault();
      return;
    }
    // `L` focuses the chat input (R1.7). On the desktop shell the input lives in
    // the peek drawer unless the Log activity is already on stage; expand the
    // drawer first so there's something to focus.
    if (e.key === 'l' || e.key === 'L') {
      const onStage = shell.activeActivity === 'log';
      if (!onStage && !shell.drawerExpanded) shell.toggleDrawer();
      // If the drawer just expanded, its ChatInput hasn't mounted yet —
      // focusChat queues the request and chat-focus.ts resolves it on mount.
      focusChat(onStage ? 'stage' : 'drawer');
      e.preventDefault();
      return;
    }
    if (/^[1-7]$/.test(e.key)) {
      const id = activityForDigit(Number(e.key), isGM);
      if (id) {
        shell.setActivity(id);
        e.preventDefault();
      }
    }
  }
</script>

<svelte:window onkeydown={onGlobalKey} />

{#if room === null}
  <p class="loading">Loading room…</p>
{:else if !hasJoined}
  <div class="join-gate">
    <h1 data-testid="room-name">{room.name}</h1>
    <p data-testid="room-id" class="room-id">Room ID: <code>{roomId}</code></p>
    <label>
      Display name
      <input
        data-testid="join-display-name"
        bind:value={joinName}
        placeholder="Your name at the table"
      />
    </label>
    <button data-testid="join-submit" onclick={join} disabled={joining}>
      {joining ? 'Joining…' : 'Join room'}
    </button>
    {#if joinError}
      <p class="error">{joinError}</p>
    {/if}
  </div>
{:else}
  <!-- The one-activity-at-a-time stage, shared by the desktop grid and the
  mobile single-activity frame (Master Plan v2, R1.8). -->
  {#snippet activityStage(room: Room)}
    {#if shell.activeActivity === 'map'}
      {#if map}
        {#key `${roomId}:${map.id}`}
          <VectorMapView {roomId} mapId={map.id} {map} {room} />
        {/key}
      {:else}
        <p class="loading" data-testid="map-loading">Loading map…</p>
      {/if}
      <HandoutViewer handout={room.handout} />
    {:else if shell.activeActivity === 'encounter'}
      <EncounterBoard
        {roomId}
        {tokens}
        {groups}
        {encounter}
        {isGM}
        myUid={myUid ?? ''}
        {players}
        {profiles}
        template={room.profileTemplate}
        {rolls}
        {selectedSeatId}
        onSelectActor={(seatId) => (selectedSeatId = seatId)}
        gmChromeInline={isMobile}
      />
      <HandoutViewer handout={room.handout} />
    {:else if shell.activeActivity === 'dice'}
      <div class="pad" data-testid="dice-activity">
        <DiceTray {roomId} authorUid={myUid ?? ''} {isGM} {players} />
      </div>
    {:else if shell.activeActivity === 'characters'}
      <div class="pad" data-testid="characters-activity">
        {#if showBackToMine}
          <button
            class="back-to-mine"
            data-testid="dock-back-to-mine"
            onclick={() => (selectedSeatId = null)}
          >
            ← Back to my sheet
          </button>
        {/if}
        <CharacterDock
          template={room.profileTemplate}
          profile={dockProfile}
          seatId={dockSeatId}
          readOnly={dockReadOnly}
          canSetOwnToken={dockSeatId === (myUid ?? '')}
          {roomId}
          {players}
          {tokens}
        />
      </div>
    {:else if shell.activeActivity === 'log'}
      <LogActivity entries={log} {roomId} {players} authorUid={myUid ?? ''} />
    {:else if shell.activeActivity === 'assets'}
      <AssetsActivity {roomId} mapId={room.activeMapId ?? null} myUid={myUid ?? ''} {isGM} />
    {:else if shell.activeActivity === 'session'}
      <SessionActivity {roomId} {room} {map} {isGM} {players} />
    {/if}
  {/snippet}

  {#if isMobile}
    <!-- Mobile / tablet single-activity frame (R1.8): compact top bar, full
    stage, tool bottom-sheet, bottom activity bar. No mini-cards on mobile. -->
    <div class="mshell" data-testid="app-shell-mobile">
      <div class="mrail-top">
        <MobileTopBar roomName={room.name} {players} {linkCopied} onCopyInvite={copyShareLink} />
      </div>
      <div class="mstage" data-testid="shell-stage">
        {@render activityStage(room)}
      </div>
      {#if activeHasTools}
        <ToolSheet controller={mapCtrl} />
      {/if}
      <div class="mrail-bottom">
        <MobileActivityBar
          activities={visibleActivities}
          activeActivity={shell.activeActivity}
          {logUnread}
          onSelect={(id) => shell.setActivity(id)}
        />
      </div>
    </div>
  {:else}
    <div
      class="shell"
      style={`--right-w:${rightWidth}px; --bottom-h:${bottomHeight}px`}
      data-testid="app-shell"
    >
      <div class="rail-top">
        <SessionTab
          roomName={room.name}
          {roomId}
          {players}
          gmUid={room.gmUid}
          {isGM}
          myRole={me?.role ?? ''}
          {linkCopied}
          onCopyInvite={copyShareLink}
          onOpenSession={() => shell.setActivity('session')}
        />
      </div>

      <div class="rail-left">
        <ActivitiesRail
          activities={visibleActivities}
          activeActivity={shell.activeActivity}
          flyout={shell.flyout}
          {logUnread}
          {onActivate}
        />
      </div>

      <div class="stage" data-testid="shell-stage">
        {#if shell.flyout}
          <!-- Clicking the stage closes an open mini-card (Option A, R1.3). An
          interactive scrim keeps this keyboard-accessible; Esc also closes. -->
          <button class="stage-scrim" aria-label="Close menu" onclick={() => shell.closeFlyout()}
          ></button>
        {/if}
        {@render activityStage(room)}
      </div>

      <div class="rail-right">
        <ToolsRail
          activeActivity={shell.activeActivity}
          controller={mapCtrl}
          collapsed={shell.toolsCollapsed}
          onToggle={() => shell.toggleTools()}
          {roomId}
          {groups}
          {tokens}
          {players}
          {isGM}
          myUid={myUid ?? ''}
        />
      </div>

      <div class="rail-bottom">
        <LogRail
          entries={log}
          {players}
          expanded={shell.drawerExpanded}
          {roomId}
          authorUid={myUid ?? ''}
          onToggle={() => shell.toggleDrawer()}
          onOpenFull={() => shell.setActivity('log')}
        />
      </div>

      <!-- Activities-rail mini-card flyouts (docked, one per rail) -->
      {#if shell.flyout?.activity === 'dice'}
        <DiceMiniCard
          {roomId}
          authorUid={myUid ?? ''}
          {isGM}
          {players}
          style="left:48px; top:40px"
          onClose={() => shell.closeFlyout()}
          onOpenFull={() => shell.setActivity('dice')}
        />
      {:else if shell.flyout?.activity === 'characters'}
        <CharactersMiniCard
          template={room.profileTemplate}
          profile={dockProfile}
          seatId={dockSeatId}
          {roomId}
          {players}
          {tokens}
          readOnly={dockReadOnly}
          canSetOwnToken={dockSeatId === (myUid ?? '')}
          showBack={showBackToMine}
          style="left:48px; top:40px"
          onClose={() => shell.closeFlyout()}
          onOpenFull={() => shell.setActivity('characters')}
          onBackToMine={() => (selectedSeatId = null)}
        />
      {/if}
    </div>
  {/if}

  <!-- Fixed-position overlays shared by both layouts (R1.5 z-order: above the
  frame, below nothing but each other). The dice overlay canvas is
  pointer-transparent; dialogs/toasts sit on top. -->
  <div class="dice-overlay-layer" class:mobile={isMobile}>
    <DiceOverlay {rolls} {players} />
  </div>

  {#if shell.dialog === 'shortcuts'}
    <ShortcutSheet onClose={() => shell.closeDialog()} />
  {/if}
  {#if dialogs.prompt}
    <PromptDialog
      request={dialogs.prompt}
      onConfirm={(v) => dialogs.confirmPrompt(v)}
      onCancel={() => dialogs.cancelPrompt()}
    />
  {/if}
  {#if dialogs.confirmRequest}
    <ConfirmDialog
      request={dialogs.confirmRequest}
      onConfirm={() => dialogs.resolveConfirm(true)}
      onCancel={() => dialogs.resolveConfirm(false)}
    />
  {/if}
  {#if dialogs.tokenPicker}
    <TokenPickerDialog
      request={dialogs.tokenPicker}
      onConfirm={(v) => dialogs.confirmTokenPicker(v)}
      onCancel={() => dialogs.cancelTokenPicker()}
    />
  {/if}
{/if}

<style>
  .loading {
    padding: 2rem;
  }
  .join-gate {
    max-width: 420px;
    margin: 3rem auto;
    padding: 1.5rem;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
  }
  .join-gate label {
    display: block;
    margin: 0.75rem 0;
  }
  .join-gate input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .room-id code {
    user-select: all;
  }
  .error {
    color: var(--failure);
  }
  .join-gate button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
  }

  /* ---- Activity shell frame (Master Plan v2, R1 · Option A) ---- */
  .shell {
    position: relative;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: grid;
    grid-template-columns: 44px 1fr var(--right-w);
    grid-template-rows: 34px 1fr var(--bottom-h);
    grid-template-areas:
      'top top top'
      'left stage right'
      'bottom bottom bottom';
    background: var(--bg-root);
  }
  .rail-top {
    grid-area: top;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .rail-left {
    grid-area: left;
    background: var(--bg-panel);
    border-right: 1px solid var(--line);
    overflow: hidden;
  }
  .rail-right {
    grid-area: right;
    min-width: 0;
    overflow: hidden;
  }
  .rail-bottom {
    grid-area: bottom;
    min-height: 0;
  }
  .stage {
    grid-area: stage;
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-inset);
  }
  .stage-scrim {
    position: absolute;
    inset: 0;
    z-index: 5;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    cursor: default;
  }
  .pad {
    height: 100%;
    overflow-y: auto;
    padding: 0.75rem;
    box-sizing: border-box;
  }
  .back-to-mine {
    margin-bottom: 0.5rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  /* ---- Mobile / tablet single-activity frame (Master Plan v2, R1.8) ---- */
  .mshell {
    position: relative;
    height: 100vh;
    height: 100dvh;
    width: 100vw;
    overflow: hidden;
    display: grid;
    grid-template-rows: 40px 1fr 52px;
    grid-template-areas:
      'mtop'
      'mstage'
      'mbottom';
    background: var(--bg-root);
  }
  .mrail-top {
    grid-area: mtop;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .mstage {
    grid-area: mstage;
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-inset);
  }
  .mrail-bottom {
    grid-area: mbottom;
    background: var(--bg-panel);
    border-top: 1px solid var(--line);
    min-height: 0;
  }
  /* WI-4 (R3.4): the dice overlay is now the real full-stage renderer — a
   * fixed, full-viewport, click-through canvas above the frame. It must never
   * intercept clicks on stage controls beneath it. */
  .dice-overlay-layer {
    position: fixed;
    inset: 0;
    z-index: 50;
    pointer-events: none;
  }
  .dice-overlay-layer.mobile {
    inset: 0;
  }
</style>
