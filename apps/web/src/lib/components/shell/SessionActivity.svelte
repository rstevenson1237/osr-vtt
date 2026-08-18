<script lang="ts">
  import { getContext } from 'svelte';
  import QRCode from 'qrcode';
  import {
    ABANDONED_SEAT_DAYS,
    abandonedSeatUids,
    archiveToSnapshot,
    snapshotToArchive,
    type CampaignStore,
    DIE_SIDE_OPTIONS,
    type Encounter,
    type EncounterMode,
    type GameMap,
    type Group,
    type PlayerSeat,
    type ProfileTemplateField,
    type ResultClass,
    type RollBand,
    type RollConvention,
    type Room,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY, SESSION_MODE_KEY, type SessionMode } from '../../context';
  import { navigateToLobby, navigateToRoom, roomShareUrl } from '../../routes';
  import { THEMES } from '../../theme';
  import ProfileTemplateEditor from '../ProfileTemplateEditor.svelte';
  import TensionBar from '../TensionBar.svelte';
  import HandoutPanel from '../HandoutPanel.svelte';
  import PlayersPanel from './PlayersPanel.svelte';

  /**
   * Session Config activity (GM-only, referee group — Master Plan v2, R4).
   * A single scrolling stage with anchored sections: Room, Grid &
   * measurement, Fog, Profile template, Encounter profile, Tension defaults,
   * Players. The Encounter profile section is where the referee both shapes
   * the encounter's fields (same editor, same field types as the profile
   * template) and sets the live values the top status bar shows read-only. Every
   * setter here is a thin, direct `CampaignStore` call — the same pattern
   * `ProfileTemplateEditor`/`HandoutPanel` already use — so every section's
   * writes round-trip and sync to every other client exactly like the rest
   * of the room doc.
   */
  let {
    roomId,
    room,
    map,
    isGM,
    players,
    groups,
    encounter,
    presentSeatIds = new Set<string>(),
  }: {
    roomId: string;
    room: Room;
    map: GameMap | null;
    isGM: boolean;
    players: PlayerSeat[];
    /** Live presence (R26.1) — gates the inactive-seat prune so a connected
     * player can never be listed, however old their stamp. */
    presentSeatIds?: ReadonlySet<string>;
    /** The room's groups, in board order — the option list for the default
     * player group (group ownership). */
    groups: Group[];
    encounter: Encounter | null;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  const template = $derived(room.profileTemplate as ProfileTemplateField[]);
  // Rooms migrated to v14 always carry this; `?? []` covers the window before
  // a pre-v14 doc has been through `migrateRoom`.
  const encounterTemplate = $derived((room.encounterTemplate ?? []) as ProfileTemplateField[]);

  const SECTIONS = [
    { id: 'session-room', label: 'Room' },
    // Maps moved to the Assets activity — managing which maps exist is asset
    // management, not session-wide config.
    { id: 'session-grid', label: 'Grid & measurement' },
    { id: 'session-fog', label: 'Fog of war' },
    { id: 'session-template', label: 'Profile template' },
    { id: 'session-encounter', label: 'Encounter profile' },
    { id: 'session-initiative', label: 'Initiative' },
    { id: 'session-conventions', label: 'Roll conventions' },
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
  // A local build has nobody to invite, no seats but the referee's own, and no
  // lobby to return to after deleting a room — the campaign *is* the file
  // (SPEC-041 §§1, 3). Import is the local lobby's job there, not this panel's:
  // opening a different campaign means opening a different file.
  const { multiplayer } = getContext<SessionMode>(SESSION_MODE_KEY);
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

  async function setFogEnabled(enabled: boolean): Promise<void> {
    if (!map) return;
    await store.setMapFogEnabled(roomId, map.id, enabled);
  }

  async function selectTheme(theme: string): Promise<void> {
    await store.setTheme(roomId, theme);
  }

  // ---- Background (Master Plan v2, R15/WI-19) ----
  // Background management — image *and* colour — moved out of this activity
  // to the Assets activity's `BackgroundsPanel` (SPEC-038 §5, WI-081), along
  // with every `session-background-*` testid it used to carry. A map now holds
  // any number of placed images, and placing them means moving and resizing
  // them against the alignment grid on the canvas, which is not something a
  // modal list of session settings can do.

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

  // ---- Grid & measurement (per map, Master Plan v2, R17.3) ----
  // The old grid-shrink guard (D3, docs/VTT_Master_Plan.md Part V §2) checked the
  // requested w/h against the carved cellular floor's bounding box. The
  // vector floor is an unbounded set of polygon regions with no cell-grid
  // ceiling to shrink against, so that guard no longer applies — the floor's
  // own soft max-extent is enforced at carve-commit time instead (see
  // `MAX_FLOOR_EXTENT` in `apps/web/src/lib/map/vector-tools.ts`).

  // eslint-disable-next-line svelte/valid-compile
  let gridWDraft = $state(map?.grid.w ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let gridHDraft = $state(map?.grid.h ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let cellSizeDraft = $state(map?.grid.cellSize ?? 0);
  $effect(() => {
    gridWDraft = map?.grid.w ?? 0;
    gridHDraft = map?.grid.h ?? 0;
    cellSizeDraft = map?.grid.cellSize ?? 0;
  });
  let gridError = $state('');

  async function applyGrid(): Promise<void> {
    if (!map) return;
    gridError = '';
    if (gridWDraft < 1 || gridHDraft < 1) {
      gridError = 'Grid must be at least 1×1 cells.';
      return;
    }
    await store.setMapGridDimensions(roomId, map.id, {
      w: gridWDraft,
      h: gridHDraft,
      cellSize: cellSizeDraft,
    });
  }

  // eslint-disable-next-line svelte/valid-compile
  let perSquareDraft = $state(map?.measure.perSquare ?? 0);
  // eslint-disable-next-line svelte/valid-compile
  let unitDraft = $state(map?.measure.unit ?? '');
  $effect(() => {
    perSquareDraft = map?.measure.perSquare ?? 0;
    unitDraft = map?.measure.unit ?? '';
  });
  async function applyMeasure(): Promise<void> {
    if (!map) return;
    await store.setMapMeasurement(roomId, map.id, { perSquare: perSquareDraft, unit: unitDraft });
  }

  async function setSubdivide(subdivide: boolean): Promise<void> {
    if (!map) return;
    await store.setMapGridSubdivide(roomId, map.id, subdivide);
  }

  // ---- Tension defaults ----

  // ---- Initiative (the revamp §1): how the table runs initiative, and the
  // fallback die for any row whose actor has no `initiative` template field.
  // These moved off the Combat Tracker's mode radios, which rendered for
  // players who could never commit them.

  const INITIATIVE_MODES: { id: EncounterMode; label: string; hint: string }[] = [
    {
      id: 'free',
      label: 'Free',
      hint: 'The app tracks nothing — no order, no rounds, no tracker. Call for rolls yourself; players use the Roll sheet. Any rules system.',
    },
    {
      id: 'side',
      label: 'Side-based',
      hint: 'One initiative row per active group. Uses the Initiative die on the encounter profile.',
    },
    {
      id: 'individual',
      label: 'Individual',
      hint: "One initiative row per active token. Uses the Initiative die on each player's profile.",
    },
  ];

  // eslint-disable-next-line svelte/valid-compile
  let initiativeModeDraft = $state<EncounterMode>(room.settings.initiativeMode ?? 'side');
  // eslint-disable-next-line svelte/valid-compile
  let initiativeDieDraft = $state(room.settings.initiativeDie ?? 'd6');
  $effect(() => {
    initiativeModeDraft = room.settings.initiativeMode ?? 'side';
    initiativeDieDraft = room.settings.initiativeDie ?? 'd6';
  });
  async function applyInitiative(): Promise<void> {
    await store.setInitiativeConfig(roomId, {
      initiativeMode: initiativeModeDraft,
      initiativeDie: initiativeDieDraft,
    });
  }

  // ---- Default player group (group ownership) ----
  //
  // Where a newly joined seat lands. The referee's client applies it (see
  // `RoomShell`'s reconciliation effect) because groups are GM-write-only.

  // eslint-disable-next-line svelte/valid-compile
  let defaultGroupDraft = $state(room.settings.defaultPlayerGroup ?? 'first');
  $effect(() => {
    defaultGroupDraft = room.settings.defaultPlayerGroup ?? 'first';
  });
  async function applyDefaultGroup(): Promise<void> {
    await store.setDefaultPlayerGroup(roomId, defaultGroupDraft);
  }

  // ---- Roll conventions (the revamp §5): referee-authored result bands.
  // Data the referee wrote, never logic the app knows (§2.5) — the app looks
  // up which band a number falls in and paints that band's colour and word.

  const conventions = $derived((room.rollConventions ?? []) as RollConvention[]);
  const RESULT_CLASSES: ResultClass[] = ['success', 'complication', 'failure'];

  async function saveConventions(next: RollConvention[]): Promise<void> {
    await store.setRollConventions(roomId, next);
  }

  function patchConvention(id: string, patch: Partial<RollConvention>): void {
    void saveConventions(conventions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function patchBand(conventionId: string, index: number, patch: Partial<RollBand>): void {
    patchConvention(conventionId, {
      bands: (conventions.find((c) => c.id === conventionId)?.bands ?? []).map((b, i) =>
        i === index ? { ...b, ...patch } : b,
      ),
    });
  }

  /** `''` clears the bound back to open-ended, which is how a band says
   * "anything at or above/below" without a sentinel number. */
  function boundFromInput(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }

  function addBand(conventionId: string): void {
    const cur = conventions.find((c) => c.id === conventionId);
    if (!cur) return;
    patchConvention(conventionId, {
      bands: [...cur.bands, { min: 1, class: 'success', label: 'Result' }],
    });
  }

  function removeBand(conventionId: string, index: number): void {
    const cur = conventions.find((c) => c.id === conventionId);
    if (!cur) return;
    patchConvention(conventionId, { bands: cur.bands.filter((_, i) => i !== index) });
  }

  let newConventionLabel = $state('');
  function addConvention(): void {
    const label = newConventionLabel.trim();
    if (!label) return;
    // Slugged id + a short random suffix: the referee may well create two
    // conventions with the same label for different die sizes.
    const id = `${
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'convention'
    }-${Math.random().toString(36).slice(2, 6)}`;
    void saveConventions([
      ...conventions,
      { id, label, applies: {}, bands: [{ min: 1, class: 'success', label: 'Success' }] },
    ]);
    newConventionLabel = '';
  }

  function removeConvention(id: string): void {
    void saveConventions(conventions.filter((c) => c.id !== id));
  }

  // ---- Maintenance & danger zone (Master Plan v2, R6.3 / R6.4) ----
  // ---- Prune inactive seats (R26.3) ----
  // Never automatic, always referee-confirmed, and never a seat with live
  // presence — `abandonedSeatUids` enforces that last part, so the list here
  // cannot include someone who is connected right now.
  let selectedInactive = $state<Set<string>>(new Set());
  let alsoDeleteInactiveProfiles = $state(false);
  let confirmingInactive = $state(false);
  let pruningSeats = $state(false);
  let inactiveError = $state('');

  const inactiveUids = $derived(abandonedSeatUids(players, presentSeatIds));
  const inactiveSeats = $derived(players.filter((p) => inactiveUids.has(p.uid)));

  function toggleInactive(uid: string): void {
    const next = new Set(selectedInactive);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    selectedInactive = next;
  }

  function inactiveAge(seat: PlayerSeat): string {
    if (seat.lastPresentAt === undefined) return '';
    const days = Math.round((Date.now() - seat.lastPresentAt) / (24 * 60 * 60 * 1000));
    return `last present ${days}d ago`;
  }

  async function pruneInactiveSeats(): Promise<void> {
    if (pruningSeats) return;
    pruningSeats = true;
    inactiveError = '';
    try {
      // Reuses the same removal path the Players panel uses, character-sheet
      // option included — there is no second, bulk delete path to keep correct.
      for (const uid of selectedInactive) {
        await store.removePlayer(roomId, uid, { deleteProfile: alsoDeleteInactiveProfiles });
      }
      selectedInactive = new Set();
      confirmingInactive = false;
      alsoDeleteInactiveProfiles = false;
    } catch (err) {
      inactiveError = err instanceof Error ? err.message : 'Failed to remove seats';
    } finally {
      pruningSeats = false;
    }
  }

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
        <button
          type="button"
          class="section-nav-link"
          data-testid={`session-nav-${s.id}`}
          onclick={() =>
            document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {s.label}
        </button>
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

      {#if multiplayer}
        <div class="invite">
          <label class="field">
            Invite link
            <input data-testid="session-invite-link" value={inviteLink} readonly />
          </label>
          <button data-testid="session-copy-invite" onclick={copyInvite}>
            {linkCopied ? 'Copied!' : 'Copy'}
          </button>
          {#if qrDataUrl}
            <img
              class="qr"
              data-testid="session-invite-qr"
              src={qrDataUrl}
              alt="Invite link QR code"
            />
          {/if}
        </div>
      {/if}

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

      <!-- Background management (image *and* colour) lives in the Assets
      activity since SPEC-038 §5 — `BackgroundsPanel`, beside `MapsPanel`.
      There is no `session-background-*` control here any more. -->

      <div class="export-import">
        <button data-testid="session-export-room" onclick={exportRoomFile} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export .vttcamp'}
        </button>
        {#if multiplayer}
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
        {/if}
      </div>
    </section>

    {#if map}
      <!-- Room management moved out of Session settings and into the Room quick
      sheet (Shell UI Redesign) so every player — not just the referee — can
      reach the room list and its shared players' notes. Session settings keeps
      only session-wide config and the maintenance danger zone. -->
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
            checked={map.gridSettings.subdivide}
            onchange={(e) => void setSubdivide((e.target as HTMLInputElement).checked)}
          />
          Half-grid subdivision
        </label>

        <div class="row">
          <label class="field narrow">
            Per square
            <input
              type="number"
              min="1"
              data-testid="measure-per-square"
              bind:value={perSquareDraft}
            />
          </label>
          <label class="field narrow">
            Unit
            <input type="text" data-testid="measure-unit" bind:value={unitDraft} />
          </label>
          <button data-testid="measure-apply" onclick={applyMeasure}>Set</button>
        </div>
      </section>

      <!-- Fog of war (docs/VTT_Master_Plan.md Part II §2 (fog)). The on/off switch is a
      per-map session setting, not a drawing tool — it moved here out of the
      Map tools sheet (playtest feedback), which now carries only the fog
      *authoring* controls (the Fog carve modes, Reveal all / Reset fog). -->
      <section id="session-fog">
        <h3>Fog of war</h3>
        <label class="field checkbox">
          <input
            type="checkbox"
            data-testid="fog-enabled-toggle"
            checked={map.fog?.enabled ?? false}
            onchange={(e) => void setFogEnabled((e.target as HTMLInputElement).checked)}
          />
          Fog of war on this map
        </label>
        <p class="hint">
          With fog on, players see only what you have revealed — and tokens standing in fog are
          hidden from them. Reveal areas from the Map tools sheet: set a shape tool's Carve to “Fog:
          reveal”, or use Reveal all / Reset fog in its expanded view.
        </p>
      </section>
    {/if}

    <section id="session-template">
      <h3>Profile template</h3>
      <ProfileTemplateEditor {roomId} {template} />
    </section>

    <section>
      <h3>Handout</h3>
      <HandoutPanel {roomId} {isGM} revealedRef={room.handout?.ref ?? null} />
    </section>

    <section id="session-encounter">
      <h3>Encounter profile</h3>
      <p class="hint">
        The encounter's own fields — the same field types as the profile template above. Difficulty,
        Danger and Clock are just the defaults every room starts with; relabel, retype, reorder or
        delete them like any other field. Pinned fields show in the top status bar, where you can
        adjust their values mid-play and players see them read-only.
      </p>
      <ProfileTemplateEditor
        {roomId}
        template={encounterTemplate}
        target="encounter"
        title="Encounter Template"
        pinHint="status bar"
      />
      <div class="encounter-tension">
        <h4>Values</h4>
        <TensionBar
          {roomId}
          {encounter}
          {isGM}
          myUid={room.gmUid}
          {conventions}
          encounterFields={encounterTemplate}
        />
      </div>
    </section>

    <section id="session-initiative">
      <h3>Initiative</h3>
      <p class="hint">
        How this table runs initiative. This replaces the mode buttons that used to sit on the
        Combat Tracker. Changing it does not reshape a fight already in progress — a running
        encounter keeps the mode it started with.
      </p>
      <div class="init-modes">
        {#each INITIATIVE_MODES as m (m.id)}
          <label class="init-mode" class:selected={initiativeModeDraft === m.id}>
            <input
              type="radio"
              name="initiative-mode"
              value={m.id}
              data-testid={`session-initiative-mode-${m.id}`}
              checked={initiativeModeDraft === m.id}
              onchange={() => {
                initiativeModeDraft = m.id;
                void applyInitiative();
              }}
            />
            <span class="init-mode-label">{m.label}</span>
            <span class="init-mode-hint">{m.hint}</span>
          </label>
        {/each}
      </div>
      {#if initiativeModeDraft !== 'free'}
        <div class="row">
          <label class="field narrow">
            Default initiative die
            <select
              data-testid="session-initiative-die"
              bind:value={initiativeDieDraft}
              onchange={() => void applyInitiative()}
            >
              {#each DIE_SIDE_OPTIONS as sides (sides)}
                <option value={`d${sides}`}>d{sides}</option>
              {/each}
            </select>
          </label>
        </div>
        <p class="hint">
          Used for any row whose actor has no Initiative field of its own — including every group or
          token with no assigned player. Add an <code>initiative</code> field to the
          {initiativeModeDraft === 'individual' ? 'profile template' : 'encounter profile'} above to override
          it per actor.
        </p>
      {/if}
    </section>

    <section id="session-conventions">
      <h3>Roll conventions</h3>
      <p class="hint">
        How rolled numbers are labelled and coloured at this table. These are <em>your</em> bands, not
        the app's: it looks up which band a number falls in and shows that band's word and colour — it
        never decides what the result means. A roll that matches no convention shows its faces and total
        with no classification at all.
      </p>
      <ul class="conventions">
        {#each conventions as convention (convention.id)}
          <li class="convention" data-testid={`convention-row-${convention.id}`}>
            <div class="row convention-head">
              <label class="field">
                Name
                <input
                  data-testid={`convention-label-${convention.id}`}
                  value={convention.label}
                  onchange={(e) => patchConvention(convention.id, { label: e.currentTarget.value })}
                />
              </label>
              <label class="field narrow">
                Mode
                <select
                  data-testid={`convention-mode-${convention.id}`}
                  value={convention.applies.mode ?? ''}
                  onchange={(e) =>
                    patchConvention(convention.id, {
                      applies: {
                        ...convention.applies,
                        mode: e.currentTarget.value
                          ? (e.currentTarget.value as 'summed' | 'separate')
                          : undefined,
                      },
                    })}
                >
                  <option value="">Any</option>
                  <option value="separate">Separate</option>
                  <option value="summed">Summed</option>
                </select>
              </label>
              <label class="field narrow">
                Die
                <select
                  data-testid={`convention-sides-${convention.id}`}
                  value={convention.applies.sides ? String(convention.applies.sides) : ''}
                  onchange={(e) =>
                    patchConvention(convention.id, {
                      applies: {
                        ...convention.applies,
                        sides: e.currentTarget.value ? Number(e.currentTarget.value) : undefined,
                      },
                    })}
                >
                  <option value="">Any</option>
                  {#each DIE_SIDE_OPTIONS as sides (sides)}
                    <option value={String(sides)}>d{sides}</option>
                  {/each}
                </select>
              </label>
              <button
                class="danger"
                data-testid={`convention-delete-${convention.id}`}
                onclick={() => removeConvention(convention.id)}>Remove</button
              >
            </div>
            <ul class="bands">
              {#each convention.bands as band, i (i)}
                <li class="band" data-testid={`convention-band-${convention.id}-${i}`}>
                  <label class="field tiny">
                    Min
                    <input
                      type="number"
                      value={band.min ?? ''}
                      onchange={(e) =>
                        patchBand(convention.id, i, { min: boundFromInput(e.currentTarget.value) })}
                    />
                  </label>
                  <label class="field tiny">
                    Max
                    <input
                      type="number"
                      value={band.max ?? ''}
                      onchange={(e) =>
                        patchBand(convention.id, i, { max: boundFromInput(e.currentTarget.value) })}
                    />
                  </label>
                  <label class="field narrow">
                    Shows as
                    <select
                      value={band.class}
                      onchange={(e) =>
                        patchBand(convention.id, i, {
                          class: e.currentTarget.value as ResultClass,
                        })}
                    >
                      {#each RESULT_CLASSES as c (c)}
                        <option value={c}>{c}</option>
                      {/each}
                    </select>
                  </label>
                  <label class="field">
                    Label
                    <input
                      value={band.label}
                      onchange={(e) =>
                        patchBand(convention.id, i, { label: e.currentTarget.value })}
                    />
                  </label>
                  <button onclick={() => removeBand(convention.id, i)}>×</button>
                </li>
              {/each}
            </ul>
            <button
              data-testid={`convention-band-add-${convention.id}`}
              onclick={() => addBand(convention.id)}>Add band</button
            >
            <p class="hint">
              Leave Min or Max empty for an open-ended band. Bands are checked top to bottom, so the
              first one that matches wins.
            </p>
          </li>
        {/each}
      </ul>
      <div class="row">
        <label class="field">
          New convention
          <input
            data-testid="convention-new-label"
            placeholder="e.g. Attack roll"
            bind:value={newConventionLabel}
          />
        </label>
        <button data-testid="convention-add" onclick={addConvention}>Add</button>
      </div>
    </section>

    {#if multiplayer}
      <section id="session-players">
        <h3>Players</h3>

        <label class="field">
          Default player group
          <select
            data-testid="session-default-group"
            bind:value={defaultGroupDraft}
            onchange={() => void applyDefaultGroup()}
          >
            <option value="first">First available group</option>
            <option value="unassigned">Unassigned</option>
            {#each groups as group (group.id)}
              <option value={group.id}>{group.name}</option>
            {/each}
          </select>
        </label>
        <p class="hint">
          Where a player lands when they join. A player in a group can play every character in it;
          the referee is in every group. Deleting the group named here puts this back to the first
          available one.
        </p>

        <PlayersPanel {roomId} {players} gmUid={room.gmUid} {presentSeatIds} />
      </section>
    {/if}

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
            <button data-testid="prune-start" onclick={() => (confirmingPrune = true)}
              >Prune…</button
            >
          {/if}
        </div>
        {#if pruneResult}
          <p class="maint-note" data-testid="prune-result">{pruneResult}</p>
        {/if}
      </div>

      {#if multiplayer && inactiveSeats.length > 0}
        <div class="maint-block danger-zone" data-testid="inactive-seats">
          <p class="maint-label">Inactive seats</p>
          <p class="maint-note">
            These players have not connected in over {ABANDONED_SEAT_DAYS} days. Removing a seat frees
            its slot; it never touches a player who is currently connected.
          </p>
          {#each inactiveSeats as seat (seat.uid)}
            <label class="inactive-row" data-testid={`inactive-seat-${seat.uid}`}>
              <input
                type="checkbox"
                data-testid={`inactive-seat-check-${seat.uid}`}
                checked={selectedInactive.has(seat.uid)}
                onchange={() => toggleInactive(seat.uid)}
              />
              <span class="inactive-name">{seat.displayName}</span>
              <span class="maint-note inline">{inactiveAge(seat)} · {seat.role}</span>
            </label>
          {/each}
          <label class="maint-note check">
            <input
              type="checkbox"
              data-testid="inactive-delete-profiles"
              bind:checked={alsoDeleteInactiveProfiles}
            />
            also delete their character sheets
          </label>
          {#if confirmingInactive}
            <div class="inline-confirm" data-testid="inactive-confirm">
              <span class="confirm-msg">
                Remove {selectedInactive.size} seat{selectedInactive.size === 1 ? '' : 's'}?
              </span>
              <button
                class="danger"
                data-testid="inactive-prune-run"
                disabled={pruningSeats}
                onclick={pruneInactiveSeats}
              >
                {pruningSeats ? 'Removing…' : 'Remove'}
              </button>
              <button data-testid="inactive-cancel" onclick={() => (confirmingInactive = false)}>
                Cancel
              </button>
            </div>
          {:else}
            <button
              class="danger"
              data-testid="inactive-prune-start"
              disabled={selectedInactive.size === 0}
              onclick={() => (confirmingInactive = true)}
            >
              Remove {selectedInactive.size} selected seat{selectedInactive.size === 1 ? '' : 's'}…
            </button>
          {/if}
          {#if inactiveError}
            <p class="error" data-testid="inactive-error">{inactiveError}</p>
          {/if}
        </div>
      {/if}

      {#if multiplayer}
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
      {/if}
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
  .section-nav-link {
    color: var(--text-dim);
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    text-decoration: none;
  }
  @media (hover: hover) {
    .section-nav-link:hover {
      color: var(--text);
      text-decoration: underline;
    }
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
  .field.tiny {
    max-width: 72px;
  }

  /* ---- Initiative mode picker ---- */
  .init-modes {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .init-mode {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: 'radio label' 'radio hint';
    gap: 0.1rem 0.6rem;
    align-items: start;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
  }
  .init-mode.selected {
    border-color: var(--accent);
    background: var(--bg-panel-alt);
  }
  .init-mode input {
    grid-area: radio;
    margin-top: 0.2rem;
  }
  .init-mode-label {
    grid-area: label;
    font-weight: 600;
  }
  .init-mode-hint {
    grid-area: hint;
    font-size: 0.78rem;
    opacity: 0.75;
  }

  /* ---- Roll conventions ---- */
  .conventions,
  .bands {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .convention {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }
  .convention-head {
    align-items: flex-end;
  }
  .band {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.5rem;
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
  .encounter-tension {
    margin-top: 0.6rem;
  }
  .hint {
    font-size: 0.78rem;
    opacity: 0.7;
    margin: 0.2rem 0;
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
  .inactive-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-inset);
    margin-bottom: 0.4rem;
  }
  .inactive-name {
    font-weight: 600;
  }
  .maint-note.inline {
    margin: 0;
  }
  .maint-note.check {
    display: flex;
    align-items: center;
    gap: 0.4rem;
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
