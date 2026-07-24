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
  import {
    CAMPAIGN_STORE_KEY,
    DIALOG_KEY,
    MAP_TOOL_KEY,
    ROOM_NOTES_KEY,
    SHELL_STATE_KEY,
  } from '../context';
  import { roomShareUrl } from '../routes';
  import { applyTheme, resolveThemeName } from '../theme';
  import { MapToolController } from '../shell/map-tool-controller.svelte';
  import { ShellState } from '../shell/shell-state.svelte';
  import { DialogService } from '../shell/dialogs.svelte';
  import { RoomNotesDoc } from '../collab/room-notes.svelte';
  import {
    QUICK_SHEETS,
    mainViewForDigit,
    mainViewsFor,
    quickSheetById,
    quickSheetForDigit,
  } from '../shell/activities';
  import type { MainViewId, QuickSheetId } from '../shell/types';
  // Shell chrome
  import SessionTab from './shell/SessionTab.svelte';
  import MainViewTabs from './shell/MainViewTabs.svelte';
  import QuickSheetRail from './shell/QuickSheetRail.svelte';
  import QuickSheetCard from './shell/QuickSheetCard.svelte';
  import ShellOverlay from './shell/ShellOverlay.svelte';
  import Icon from './shell/Icon.svelte';
  import ShortcutSheet from './shell/ShortcutSheet.svelte';
  import PromptDialog from './shell/PromptDialog.svelte';
  import ConfirmDialog from './shell/ConfirmDialog.svelte';
  import TokenPickerDialog from './shell/TokenPickerDialog.svelte';
  // Mobile / tablet chrome (Master Plan v2, R1.8)
  import MobileTopBar from './shell/MobileTopBar.svelte';
  import { createLayoutMode } from '../shell/layout.svelte';
  import { focusChat } from '../log/chat-focus';
  // Main-view stages (re-housed existing components)
  import VectorMapView from './VectorMapView.svelte';
  import EncounterBoard from './EncounterBoard.svelte';
  import HandoutViewer from './HandoutViewer.svelte';
  import DiceOverlay from './DiceOverlay.svelte';
  import SessionActivity from './shell/SessionActivity.svelte';
  import LogActivity from './shell/LogActivity.svelte';
  import AssetsActivity from './shell/AssetsActivity.svelte';
  // Quick sheets
  import MapToolsSheet from './shell/sheets/MapToolsSheet.svelte';
  import CharacterSheet from './shell/sheets/CharacterSheet.svelte';
  import RollSheet from './shell/sheets/RollSheet.svelte';
  import RoomsPanel from './shell/RoomsPanel.svelte';

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
  // eslint-disable-next-line svelte/valid-compile
  const roomNotes = new RoomNotesDoc(store, roomId);
  setContext(SHELL_STATE_KEY, shell);
  setContext(MAP_TOOL_KEY, mapCtrl);
  setContext(DIALOG_KEY, dialogs);
  setContext(ROOM_NOTES_KEY, roomNotes);

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

  // Unread log badge (R1 — badge on the Log button). Seeded to the current
  // length on first load so pre-join history isn't counted as unread.
  let logSeen = $state(0);
  let logInit = false;

  let unsubs: Unsubscribe[] = [];

  const me = $derived(players.find((p) => p.uid === myUid) ?? null);
  const hasJoined = $derived(me !== null);
  const isGM = $derived(room !== null && myUid !== null && room.gmUid === myUid);
  // The Character sheet shows whichever actor's card was last selected on the
  // Encounter Board (Spec §5), defaulting back to my own sheet.
  const dockSeatId = $derived(selectedSeatId ?? myUid ?? '');
  const dockProfile = $derived(profiles.find((p) => p.seatId === dockSeatId));
  const dockReadOnly = $derived(dockSeatId !== myUid && !isGM);
  const showBackToMine = $derived(dockSeatId !== (myUid ?? ''));

  const visibleViews = $derived(mainViewsFor(isGM));
  const logUnread = $derived(Math.max(0, log.length - logSeen));

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
  // the GM switching maps) — `VectorMapView` itself is remounted on the same
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

  // A player must never land on the GM-only Assets view (e.g. a persisted
  // shell state from when they were GM, or a stale localStorage value), nor
  // hold the GM-only Session settings modal open.
  $effect(() => {
    if (room && !isGM) {
      if (shell.mainView === 'assets') shell.setMainView('map');
      if (shell.overlay === 'session') shell.closeOverlay();
    }
  });

  // Mark the log read while the Log overlay is open.
  $effect(() => {
    if (shell.overlay === 'log') logSeen = log.length;
  });

  onDestroy(() => {
    for (const unsub of unsubs) unsub();
    unsubs = [];
    mapUnsub?.();
    roomNotes.dispose();
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

  // ---- quick sheets ----

  /** The docked stack renders every open sheet in rail order; the expanded one
   * is lifted out and drawn over the backdrop instead, so it is never rendered
   * (and so never mounted) twice. */
  const dockedSheets = $derived(
    QUICK_SHEETS.filter(
      (def) => shell.isSheetOpen(def.id, isMobile) && shell.expandedId !== def.id,
    ),
  );
  const expandedDef = $derived(shell.expandedId ? quickSheetById(shell.expandedId) : null);

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
      // Innermost layer first: expanded sheet, then a Log/Session overlay.
      if (shell.expandedId) shell.collapseExpanded();
      else if (shell.overlay) shell.closeOverlay();
      else return;
      e.preventDefault();
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // reserve Ctrl+Z etc.
    if (e.key === '?') {
      shell.openShortcuts();
      e.preventDefault();
      return;
    }
    // `L` opens the Log overlay and focuses its chat input (R1.7). The input
    // hasn't mounted yet at this point — `focusChat` queues the request and
    // `chat-focus.ts` resolves it on mount.
    if (e.key === 'l' || e.key === 'L') {
      shell.openOverlay('log');
      focusChat('stage');
      e.preventDefault();
      return;
    }
    if (/^[1-7]$/.test(e.key)) {
      const digit = Number(e.key);
      const view = mainViewForDigit(digit, isGM);
      if (view) {
        shell.setMainView(view);
        e.preventDefault();
        return;
      }
      const sheet = quickSheetForDigit(digit);
      if (sheet) {
        shell.toggleSheet(sheet, isMobile);
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
  <!-- The single full-screen main view, shared by the desktop grid and the
  mobile frame (Shell UI Redesign). -->
  {#snippet mainStage(room: Room)}
    {#if shell.mainView === 'map'}
      {#if map}
        {#key `${roomId}:${map.id}`}
          <VectorMapView
            {roomId}
            mapId={map.id}
            {map}
            {room}
            {tokens}
            {groups}
            {encounter}
            {isGM}
          />
        {/key}
      {:else}
        <p class="loading" data-testid="map-loading">Loading map…</p>
      {/if}
      <HandoutViewer handout={room.handout} />
    {:else if shell.mainView === 'encounter'}
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
        gmChromeInline={true}
      />
      <HandoutViewer handout={room.handout} />
    {:else if shell.mainView === 'assets'}
      <AssetsActivity {roomId} mapId={room.activeMapId ?? null} myUid={myUid ?? ''} {isGM} />
    {/if}
  {/snippet}

  <!-- One quick sheet's body, rendered identically whether it is docked, a
  mobile bottom sheet, or the expanded focus view. -->
  {#snippet sheetBody(id: QuickSheetId, room: Room, expanded: boolean)}
    {#if id === 'maptools'}
      <MapToolsSheet controller={mapCtrl} mainView={shell.mainView} />
    {:else if id === 'character'}
      <CharacterSheet
        template={room.profileTemplate}
        profile={dockProfile}
        seatId={dockSeatId}
        {roomId}
        authorUid={myUid ?? ''}
        {players}
        {tokens}
        readOnly={dockReadOnly}
        canSetOwnToken={dockSeatId === (myUid ?? '')}
        showBack={showBackToMine}
        onBackToMine={() => (selectedSeatId = null)}
      />
    {:else if id === 'roll'}
      <RollSheet {roomId} authorUid={myUid ?? ''} {isGM} {players} {rolls} {expanded} />
    {:else if id === 'room'}
      {#if map}
        <RoomsPanel
          {roomId}
          mapId={map.id}
          {isGM}
          mode={expanded ? 'full' : 'selected'}
          showNotes={expanded}
        />
      {:else}
        <p class="sheet-hint">Loading map…</p>
      {/if}
    {/if}
  {/snippet}

  {#snippet logButton(variant: 'bar' | 'tab')}
    <button
      class={variant === 'bar' ? 'logbtn' : 'logtab'}
      data-testid="log-open"
      title="Session log"
      onclick={() => shell.openOverlay('log')}
    >
      <Icon name="log" size={variant === 'bar' ? 15 : 19} />
      <span class="loglabel">Log</span>
      {#if logUnread > 0}
        <span class="badge" data-testid="log-unread-badge">{logUnread > 9 ? '9+' : logUnread}</span>
      {/if}
    </button>
  {/snippet}

  {#if isMobile}
    <!-- Mobile / tablet frame (R1.8, restructured): compact top bar, full
    stage, quick-sheet chips, then the pinned main-view tab bar. -->
    <div class="mshell" data-testid="app-shell-mobile">
      <div class="mrail-top">
        <MobileTopBar
          roomName={room.name}
          {players}
          {linkCopied}
          {isGM}
          onCopyInvite={copyShareLink}
          onOpenSession={() => shell.openOverlay('session')}
        />
      </div>
      <div class="mstage" data-testid="shell-stage">
        {@render mainStage(room)}
      </div>

      {#each dockedSheets as def (def.id)}
        <QuickSheetCard
          {def}
          mode="mobile"
          snap={shell.mobileSnap}
          onExpand={() => shell.expandSheet(def.id, true)}
          onCollapse={() => shell.collapseExpanded()}
          onClose={() => shell.closeSheet(def.id)}
          onCycleSnap={() => shell.cycleMobileSnap()}
        >
          {@render sheetBody(def.id, room, false)}
        </QuickSheetCard>
      {/each}

      <div class="mrail-chips">
        <QuickSheetRail
          sheets={QUICK_SHEETS}
          variant="chips"
          isOpen={(id) => shell.isSheetOpen(id, true)}
          onToggle={(id) => shell.toggleSheet(id, true)}
        />
      </div>

      <div class="mrail-bottom" data-testid="mobile-activity-bar">
        <MainViewTabs
          views={visibleViews}
          active={shell.mainView}
          variant="mobile"
          onSelect={(id: MainViewId) => shell.setMainView(id)}
        />
        {@render logButton('tab')}
      </div>
    </div>
  {:else}
    <div class="shell" data-testid="app-shell">
      <div class="rail-top">
        <SessionTab
          roomName={room.name}
          {roomId}
          {players}
          gmUid={room.gmUid}
          {isGM}
          myRole={me?.role ?? ''}
          {linkCopied}
          views={visibleViews}
          mainView={shell.mainView}
          onSelectView={(id) => shell.setMainView(id)}
          onCopyInvite={copyShareLink}
          onOpenSession={() => shell.openOverlay('session')}
        />
      </div>

      <div class="rail-left">
        <QuickSheetRail
          sheets={QUICK_SHEETS}
          isOpen={(id) => shell.isSheetOpen(id, false)}
          onToggle={(id) => shell.toggleSheet(id, false)}
        />
      </div>

      <div class="stage" data-testid="shell-stage">
        {@render mainStage(room)}

        <!-- Quick sheets stack down the stage's left margin. The wrapper is
        pointer-transparent so the map canvas stays clickable around them. -->
        <div class="sheet-stack">
          {#each dockedSheets as def (def.id)}
            <QuickSheetCard
              {def}
              mode="docked"
              onExpand={() => shell.expandSheet(def.id, false)}
              onCollapse={() => shell.collapseExpanded()}
              onClose={() => shell.closeSheet(def.id)}
            >
              {@render sheetBody(def.id, room, false)}
            </QuickSheetCard>
          {/each}
        </div>
      </div>

      <div class="rail-bottom">
        {@render logButton('bar')}
        <span class="roomid-hint">Room ID: <code>{roomId}</code></span>
      </div>
    </div>
  {/if}

  <!-- Expanded quick sheet: one at a time, over a blurred backdrop with the
  main view visible-but-unfocused underneath. -->
  {#if expandedDef}
    <button
      class="sheet-backdrop"
      aria-label="Collapse sheet"
      onclick={() => shell.collapseExpanded()}
    ></button>
    <QuickSheetCard
      def={expandedDef}
      mode="expanded"
      onExpand={() => shell.expandSheet(expandedDef.id, isMobile)}
      onCollapse={() => shell.collapseExpanded()}
      onClose={() => shell.closeSheet(expandedDef.id)}
    >
      {@render sheetBody(expandedDef.id, room, true)}
    </QuickSheetCard>
  {/if}

  <!-- Log / Session settings modals -->
  {#if shell.overlay === 'log'}
    <ShellOverlay title="Session log" testid="log-overlay" onClose={() => shell.closeOverlay()}>
      <LogActivity entries={log} {roomId} {players} authorUid={myUid ?? ''} />
    </ShellOverlay>
  {:else if shell.overlay === 'session' && isGM}
    <ShellOverlay
      title="Session settings"
      testid="session-overlay"
      onClose={() => shell.closeOverlay()}
    >
      <SessionActivity {roomId} {room} {map} {isGM} {players} />
    </ShellOverlay>
  {/if}

  <!-- Fixed-position overlays shared by both layouts (R1.5 z-order: above the
  frame, below nothing but each other). The dice overlay canvas is
  pointer-transparent; dialogs/toasts sit on top. -->
  <div class="dice-overlay-layer" class:mobile={isMobile}>
    <DiceOverlay {rolls} {players} {profiles} />
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

  /* ---- Desktop shell frame (Shell UI Redesign) ---- */
  .shell {
    position: relative;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: grid;
    grid-template-columns: 56px 1fr;
    grid-template-rows: 44px 1fr 32px;
    grid-template-areas:
      'top top'
      'rail stage'
      'bottom bottom';
    background: var(--bg-root);
  }
  .rail-top {
    grid-area: top;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--line);
    min-width: 0;
  }
  .rail-left {
    grid-area: rail;
    background: var(--bg-panel);
    border-right: 1px solid var(--line);
    overflow: hidden;
  }
  .stage {
    grid-area: stage;
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-inset);
  }
  .rail-bottom {
    grid-area: bottom;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    box-sizing: border-box;
    background: var(--bg-panel);
    border-top: 1px solid var(--line);
    min-height: 0;
  }
  .roomid-hint {
    margin-left: auto;
    font-size: 0.68rem;
    color: var(--text-dim);
    letter-spacing: 0.03em;
  }
  .roomid-hint code {
    user-select: all;
  }

  .sheet-stack {
    position: absolute;
    left: 12px;
    top: 12px;
    bottom: 12px;
    width: 300px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    max-height: calc(100% - 24px);
  }

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px) saturate(120%);
    -webkit-backdrop-filter: blur(6px) saturate(120%);
    cursor: default;
  }

  .logbtn,
  .logtab {
    display: flex;
    align-items: center;
    gap: 6px;
    position: relative;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.74rem;
    padding: 4px 6px;
    border-radius: 5px;
  }
  .logbtn:hover,
  .logtab:hover {
    color: var(--text);
  }
  .logtab {
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 0;
  }
  .logtab .loglabel {
    font-size: 0.6rem;
  }
  .badge {
    min-width: 13px;
    height: 13px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--group-play);
    color: var(--bg-root);
    font-size: 0.6rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logtab .badge {
    position: absolute;
    top: 6px;
    right: calc(50% - 20px);
  }

  .sheet-hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-dim);
  }

  /* ---- Mobile / tablet frame (Master Plan v2, R1.8) ---- */
  .mshell {
    position: relative;
    height: 100vh;
    height: 100dvh;
    width: 100vw;
    overflow: hidden;
    display: grid;
    grid-template-rows: 40px 1fr 38px 52px;
    grid-template-areas:
      'mtop'
      'mstage'
      'mchips'
      'mbottom';
    background: var(--bg-root);
    /* Quick sheets sit above the chips + tab bars. */
    --mobile-sheet-bottom: 90px;
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
  .mrail-chips {
    grid-area: mchips;
    background: var(--bg-panel);
    border-top: 1px solid var(--line);
    min-height: 0;
  }
  .mrail-bottom {
    grid-area: mbottom;
    display: flex;
    align-items: stretch;
    background: var(--bg-panel);
    border-top: 1px solid var(--line);
    min-height: 0;
  }
  /* WI-4 (R3.4): the dice overlay is the full-stage renderer — a fixed,
   * full-viewport, click-through canvas above the frame. It must never
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
