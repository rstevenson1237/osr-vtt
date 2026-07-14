<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import QRCode from 'qrcode';
  import {
    archiveToSnapshot,
    carvedBoundingBox,
    snapshotToArchive,
    type CampaignStore,
    type FloorChunk,
    type PlayerSeat,
    type ProfileTemplateField,
    type Room,
    type Unsubscribe,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../../context';
  import { navigateToLobby, navigateToRoom, roomShareUrl } from '../../routes';
  import { THEMES } from '../../theme';
  import ProfileTemplateEditor from '../ProfileTemplateEditor.svelte';
  import HandoutPanel from '../HandoutPanel.svelte';
  import PlayersPanel from './PlayersPanel.svelte';

  /**
   * Session Config activity (GM-only, referee group — Master Plan v2, R4).
   * A single scrolling stage with anchored sections: Room, Grid &
   * measurement, Fog, Profile template, Tension defaults, Players. Every
   * setter here is a thin, direct `CampaignStore` call — the same pattern
   * `ProfileTemplateEditor`/`HandoutPanel` already use — so every section's
   * writes round-trip and sync to every other client exactly like the rest
   * of the room doc.
   */
  let {
    roomId,
    room,
    isGM,
    players,
  }: {
    roomId: string;
    room: Room;
    isGM: boolean;
    players: PlayerSeat[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const template = $derived(room.profileTemplate as ProfileTemplateField[]);

  const SECTIONS = [
    { id: 'session-room', label: 'Room' },
    { id: 'session-grid', label: 'Grid & measurement' },
    { id: 'session-fog', label: 'Fog' },
    { id: 'session-template', label: 'Profile template' },
    { id: 'session-tension', label: 'Tension defaults' },
    { id: 'session-players', label: 'Players' },
    { id: 'session-maintenance', label: 'Maintenance' },
  ];

  // ---- Room: name, invite link + QR, theme, export/import ----

  // eslint-disable-next-line svelte/valid-compile
  let nameDraft = $state(room.name);
  $effect(() => {
    nameDraft = room.name;
  });
  async function applyName(): Promise<void> {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === room.name) {
      nameDraft = room.name;
      return;
    }
    await store.renameRoom(roomId, trimmed);
  }

  const inviteLink = $derived(roomShareUrl(roomId));
  let linkCopied = $state(false);
  async function copyInvite(): Promise<void> {
    await navigator.clipboard.writeText(inviteLink);
    linkCopied = true;
    setTimeout(() => (linkCopied = false), 1500);
  }

  let qrDataUrl = $state('');
  $effect(() => {
    const link = inviteLink;
    QRCode.toDataURL(link, { margin: 1, width: 160 })
      .then((url) => (qrDataUrl = url))
      .catch(() => (qrDataUrl = ''));
  });

  async function selectTheme(theme: string): Promise<void> {
    await store.setTheme(roomId, theme);
  }

  let exporting = $state(false);
  let importing = $state(false);
  let importError = $state('');

  function downloadArchive(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes.slice()], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportRoomFile(): Promise<void> {
    if (exporting) return;
    exporting = true;
    try {
      const snapshot = await store.exportRoom(roomId);
      const archive = snapshotToArchive(snapshot);
      const safeName = (room.name || 'campaign').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      downloadArchive(archive, `${safeName || 'campaign'}.vttcamp`);
    } finally {
      exporting = false;
    }
  }

  async function importRoomFile(file: File): Promise<void> {
    importError = '';
    importing = true;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const snapshot = archiveToSnapshot(bytes);
      const newRoomId = await store.importRoom(snapshot);
      navigateToRoom(newRoomId);
    } catch (err) {
      importError = err instanceof Error ? err.message : 'Failed to import .vttcamp';
    } finally {
      importing = false;
    }
  }

  function onImportChange(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importRoomFile(file);
    input.value = '';
  }

  // ---- Grid & measurement ----

  let floorChunks = $state<FloorChunk[]>([]);
  let unsubFloor: Unsubscribe | null = null;
  onMount(() => {
    unsubFloor = store.subscribeFloorChunks(roomId, (c) => (floorChunks = c));
  });
  onDestroy(() => unsubFloor?.());

  // eslint-disable-next-line svelte/valid-compile
  let gridWDraft = $state(room.grid.w);
  // eslint-disable-next-line svelte/valid-compile
  let gridHDraft = $state(room.grid.h);
  // eslint-disable-next-line svelte/valid-compile
  let cellSizeDraft = $state(room.grid.cellSize);
  $effect(() => {
    gridWDraft = room.grid.w;
    gridHDraft = room.grid.h;
    cellSizeDraft = room.grid.cellSize;
  });
  let gridError = $state('');

  async function applyGrid(): Promise<void> {
    gridError = '';
    const bbox = carvedBoundingBox(floorChunks);
    if (bbox && (gridWDraft <= bbox.maxX || gridHDraft <= bbox.maxY)) {
      gridError = `Can't shrink below the carved area — needs at least ${bbox.maxX + 1}×${bbox.maxY + 1} cells.`;
      return;
    }
    await store.setGridDimensions(roomId, {
      w: gridWDraft,
      h: gridHDraft,
      cellSize: cellSizeDraft,
    });
  }

  // eslint-disable-next-line svelte/valid-compile
  let perSquareDraft = $state(room.settings.measure.perSquare);
  // eslint-disable-next-line svelte/valid-compile
  let unitDraft = $state(room.settings.measure.unit);
  $effect(() => {
    perSquareDraft = room.settings.measure.perSquare;
    unitDraft = room.settings.measure.unit;
  });
  async function applyMeasure(): Promise<void> {
    await store.setMeasurement(roomId, { perSquare: perSquareDraft, unit: unitDraft });
  }

  async function setSubdivide(subdivide: boolean): Promise<void> {
    await store.setGridSubdivide(roomId, subdivide);
  }

  // ---- Fog ----

  async function selectFogMode(mode: Room['fog']['mode']): Promise<void> {
    await store.setFogMode(roomId, mode);
  }

  let resettingFog = $state(false);
  async function resetFog(): Promise<void> {
    resettingFog = true;
    try {
      await store.resetFog(roomId);
    } finally {
      resettingFog = false;
    }
  }

  // ---- Tension defaults ----

  // eslint-disable-next-line svelte/valid-compile
  let difficultyDraft = $state(room.difficultyDie);
  // eslint-disable-next-line svelte/valid-compile
  let dangerDraft = $state(room.dangerDie);
  $effect(() => {
    difficultyDraft = room.difficultyDie;
    dangerDraft = room.dangerDie;
  });
  async function applyTension(): Promise<void> {
    await store.setTensionDefaults(roomId, {
      difficultyDie: difficultyDraft,
      dangerDie: dangerDraft,
    });
  }

  // ---- Maintenance & danger zone (Master Plan v2, R6.3 / R6.4) ----

  // Prune log + roll entries older than N days (R6.4). Export-first is offered
  // in the confirm step; the prune itself is the destructive part.
  let pruneDays = $state(30);
  let confirmingPrune = $state(false);
  let pruning = $state(false);
  let pruneResult = $state('');

  async function prune(exportFirst: boolean): Promise<void> {
    if (pruning) return;
    pruning = true;
    pruneResult = '';
    try {
      if (exportFirst) await exportRoomFile();
      const before = Date.now() - Math.max(0, pruneDays) * 86_400_000;
      const removed = await store.pruneEntriesBefore(roomId, before);
      pruneResult = `Removed ${removed.log} log ${removed.log === 1 ? 'entry' : 'entries'} and ${removed.rolls} ${removed.rolls === 1 ? 'roll' : 'rolls'}.`;
      confirmingPrune = false;
    } catch (err) {
      pruneResult = err instanceof Error ? err.message : 'Prune failed';
    } finally {
      pruning = false;
    }
  }

  // Recursive room deletion (R6.3). Inline three-way confirm so "export first"
  // is a distinct choice from "delete outright" (a yes/no dialog can't express
  // that without conflating cancel with skip-export).
  let confirmingDelete = $state(false);
  let deleting = $state(false);
  let deleteError = $state('');

  async function deleteRoomFlow(exportFirst: boolean): Promise<void> {
    if (deleting) return;
    deleting = true;
    deleteError = '';
    try {
      if (exportFirst) await exportRoomFile();
      await store.deleteRoom(roomId);
      // Best-effort: drop this room from my own My Rooms index (other members'
      // dangling entries clean themselves up as a "room gone" row).
      await store.removeMyRoom(roomId);
      navigateToLobby();
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to delete room';
      deleting = false;
    }
  }
</script>

{#if isGM}
  <div class="session-activity" data-testid="session-activity">
    <h1>Session</h1>

    <nav class="section-nav" aria-label="Session sections">
      {#each SECTIONS as s (s.id)}
        <a href={`#${s.id}`}>{s.label}</a>
      {/each}
    </nav>

    <section id="session-room">
      <h3>Room</h3>
      <label class="field">
        Name
        <input
          data-testid="session-room-name"
          bind:value={nameDraft}
          onblur={applyName}
          onkeydown={(e) => e.key === 'Enter' && applyName()}
        />
      </label>

      <div class="invite">
        <label class="field">
          Invite link
          <input data-testid="session-invite-link" value={inviteLink} readonly />
        </label>
        <button data-testid="session-copy-invite" onclick={copyInvite}>
          {linkCopied ? 'Copied!' : 'Copy'}
        </button>
        {#if qrDataUrl}
          <img class="qr" data-testid="session-invite-qr" src={qrDataUrl} alt="Invite link QR code" />
        {/if}
      </div>

      <label class="field">
        Theme
        <select
          data-testid="session-theme-select"
          value={room.settings.theme}
          onchange={(e) => void selectTheme((e.target as HTMLSelectElement).value)}
        >
          {#each THEMES as name (name)}
            <option value={name}>{name}</option>
          {/each}
        </select>
      </label>

      <div class="export-import">
        <button data-testid="session-export-room" onclick={exportRoomFile} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export .vttcamp'}
        </button>
        <label class="import-label">
          {importing ? 'Importing…' : 'Import .vttcamp'}
          <input
            type="file"
            accept=".vttcamp"
            data-testid="session-import-room"
            disabled={importing}
            onchange={onImportChange}
          />
        </label>
        {#if importError}
          <p class="error" data-testid="session-import-error">{importError}</p>
        {/if}
      </div>
    </section>

    <section id="session-grid">
      <h3>Grid & measurement</h3>
      <div class="row">
        <label class="field narrow">
          Width
          <input type="number" min="1" data-testid="session-grid-w" bind:value={gridWDraft} />
        </label>
        <label class="field narrow">
          Height
          <input type="number" min="1" data-testid="session-grid-h" bind:value={gridHDraft} />
        </label>
        <label class="field narrow">
          Cell size (px)
          <input
            type="number"
            min="1"
            data-testid="session-grid-cellsize"
            bind:value={cellSizeDraft}
          />
        </label>
        <button data-testid="session-grid-apply" onclick={applyGrid}>Set</button>
      </div>
      {#if gridError}
        <p class="error" data-testid="session-grid-error">{gridError}</p>
      {/if}

      <label class="field checkbox">
        <input
          type="checkbox"
          data-testid="grid-subdivide-toggle"
          checked={room.settings.grid.subdivide}
          onchange={(e) => void setSubdivide((e.target as HTMLInputElement).checked)}
        />
        Half-grid subdivision
      </label>

      <div class="row">
        <label class="field narrow">
          Per square
          <input type="number" min="1" data-testid="measure-per-square" bind:value={perSquareDraft} />
        </label>
        <label class="field narrow">
          Unit
          <input type="text" data-testid="measure-unit" bind:value={unitDraft} />
        </label>
        <button data-testid="measure-apply" onclick={applyMeasure}>Set</button>
      </div>
    </section>

    <section id="session-fog">
      <h3>Fog</h3>
      <label class="field">
        Mode
        <select
          data-testid="fog-mode-select"
          value={room.fog.mode}
          onchange={(e) =>
            void selectFogMode((e.target as HTMLSelectElement).value as Room['fog']['mode'])}
        >
          <option value="emergent">Emergent</option>
          <option value="manual">Manual</option>
          <option value="dynamic">Dynamic (LoS)</option>
        </select>
      </label>
      <button data-testid="session-reset-fog" onclick={resetFog} disabled={resettingFog}>
        {resettingFog ? 'Resetting…' : 'Reset fog'}
      </button>
    </section>

    <section id="session-template">
      <h3>Profile template</h3>
      <ProfileTemplateEditor {roomId} {template} />
    </section>

    <section>
      <h3>Handout</h3>
      <HandoutPanel {roomId} {isGM} revealedRef={room.handout?.ref ?? null} />
    </section>

    <section id="session-tension">
      <h3>Tension defaults</h3>
      <div class="row">
        <label class="field narrow">
          Difficulty die
          <input data-testid="session-difficulty-die" bind:value={difficultyDraft} />
        </label>
        <label class="field narrow">
          Danger die
          <input data-testid="session-danger-die" bind:value={dangerDraft} />
        </label>
        <button data-testid="session-tension-apply" onclick={applyTension}>Set</button>
      </div>
    </section>

    <section id="session-players">
      <h3>Players</h3>
      <PlayersPanel {roomId} {players} gmUid={room.gmUid} />
    </section>

    <section id="session-maintenance" data-testid="session-maintenance">
      <h3>Maintenance</h3>

      <div class="maint-block">
        <p class="maint-label">Prune old log &amp; roll entries</p>
        <div class="row">
          <label class="field narrow">
            Older than (days)
            <input type="number" min="0" data-testid="prune-days" bind:value={pruneDays} />
          </label>
          {#if confirmingPrune}
            <div class="inline-confirm" data-testid="prune-confirm">
              <span class="confirm-msg">
                Permanently delete entries older than {pruneDays} days?
              </span>
              <button data-testid="prune-export-run" disabled={pruning} onclick={() => prune(true)}>
                Export &amp; prune
              </button>
              <button
                class="danger"
                data-testid="prune-run"
                disabled={pruning}
                onclick={() => prune(false)}
              >
                {pruning ? 'Pruning…' : 'Prune'}
              </button>
              <button data-testid="prune-cancel" onclick={() => (confirmingPrune = false)}>
                Cancel
              </button>
            </div>
          {:else}
            <button data-testid="prune-start" onclick={() => (confirmingPrune = true)}>Prune…</button>
          {/if}
        </div>
        {#if pruneResult}
          <p class="maint-note" data-testid="prune-result">{pruneResult}</p>
        {/if}
      </div>

      <div class="maint-block danger-zone">
        <p class="maint-label">Delete this room</p>
        <p class="maint-note">
          Permanently removes the room and every character, token, map, log and roll in it. This
          cannot be undone.
        </p>
        {#if confirmingDelete}
          <div class="inline-confirm" data-testid="delete-room-confirm">
            <span class="confirm-msg">Delete “{room.name}” for everyone?</span>
            <button
              data-testid="delete-room-export-run"
              disabled={deleting}
              onclick={() => deleteRoomFlow(true)}
            >
              Export &amp; delete
            </button>
            <button
              class="danger"
              data-testid="delete-room-run"
              disabled={deleting}
              onclick={() => deleteRoomFlow(false)}
            >
              {deleting ? 'Deleting…' : 'Delete room'}
            </button>
            <button data-testid="delete-room-cancel" onclick={() => (confirmingDelete = false)}>
              Cancel
            </button>
          </div>
        {:else}
          <button
            class="danger"
            data-testid="delete-room-start"
            onclick={() => (confirmingDelete = true)}
          >
            Delete room…
          </button>
        {/if}
        {#if deleteError}
          <p class="error" data-testid="delete-room-error">{deleteError}</p>
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .session-activity {
    height: 100%;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.25rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .section-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.78rem;
    position: sticky;
    top: 0;
    background: var(--bg-inset);
    padding: 0.25rem 0;
    z-index: 1;
  }
  .section-nav a {
    color: var(--text-dim);
    text-decoration: none;
  }
  .section-nav a:hover {
    color: var(--text);
    text-decoration: underline;
  }
  section {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    scroll-margin-top: 2rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.82rem;
    margin-bottom: 0.6rem;
  }
  .field.narrow {
    max-width: 140px;
  }
  .field.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
  }
  input,
  select {
    padding: 0.4rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    font: inherit;
  }
  button {
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
    height: fit-content;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .invite {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
  }
  .invite .field {
    flex: 1 1 260px;
    margin-bottom: 0;
  }
  .qr {
    width: 80px;
    height: 80px;
    border-radius: 4px;
    background: #fff;
    padding: 4px;
  }
  .export-import {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .import-label {
    cursor: pointer;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
  }
  .import-label input[type='file'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
  }
  .error {
    color: var(--failure);
    font-size: 0.8rem;
    margin: 0.3rem 0 0;
  }
  .maint-block {
    margin-bottom: 1rem;
  }
  .maint-block:last-child {
    margin-bottom: 0;
  }
  .maint-label {
    font-weight: 600;
    font-size: 0.85rem;
    margin: 0 0 0.4rem;
  }
  .maint-note {
    font-size: 0.78rem;
    color: var(--text-dim);
    margin: 0.3rem 0;
  }
  .danger-zone {
    border-top: 1px solid var(--line);
    padding-top: 0.85rem;
  }
  .inline-confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .confirm-msg {
    font-size: 0.78rem;
    color: var(--text-dim);
  }
  button.danger {
    color: var(--failure);
    border-color: var(--failure);
  }
</style>
