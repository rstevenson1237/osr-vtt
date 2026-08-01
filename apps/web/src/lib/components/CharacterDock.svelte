<script lang="ts">
  import { getContext } from 'svelte';
  import {
    buildGenTokenRef,
    CHARACTER_COLOR_PALETTE,
    DEFAULT_GRID_CONFIG,
    isDieField,
    parseGenTokenRef,
    type AssetStore,
    type CampaignStore,
    type PlayerSeat,
    type ProfileInstance,
    type ProfileTemplateField,
    type EncounterMode,
    type RollConvention,
    type SharedRoll,
    type Token,
  } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY, DIALOG_KEY, MAP_TOOL_KEY } from '../context';
  import type { DialogService } from '../shell/dialogs.svelte';
  import type { MapToolController } from '../shell/map-tool-controller.svelte';
  import { buildProfileRows } from '../profile/profile-view';
  import { rollOrStage } from '../dice/roll-or-stage';
  import { defaultPortraitRef, seatLetterFor } from '../tokens/labels';
  import { writeTokenDrag } from '../tokens/drag';
  import { setGhostImage } from '../encounter/board-view';

  let {
    template,
    profile,
    seatId,
    roomId,
    players = [],
    tokens = [],
    readOnly = false,
    canSetOwnToken = false,
    myUid = '',
    conventions = [],
    sharedRoll = null,
    initiativeMode = 'side',
  }: {
    template: ProfileTemplateField[];
    profile: ProfileInstance | undefined;
    seatId: string;
    roomId: string;
    players?: PlayerSeat[];
    tokens?: Token[];
    /** Viewing another actor's card (Encounter Screen Spec §5) — fields
     * still render, but only the owning seat or the GM may edit them
     * (Security Rules already enforce this server-side; this just avoids
     * a doomed write attempt in the UI). */
    readOnly?: boolean;
    /** Shows the "My token" action (Master Plan v2, R7.3) — only when this
     * dock is showing the viewer's own seat, GM or not. */
    canSetOwnToken?: boolean;
    /** The viewing seat — a die button stages under *their* uid. */
    myUid?: string;
    conventions?: RollConvention[];
    /** Non-null while a Call for Initiative is open (see `rollOrStage`). */
    sharedRoll?: SharedRoll | null;
    initiativeMode?: EncounterMode;
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);
  const dialogs = getContext<DialogService>(DIALOG_KEY);
  /** Token snap-mode default (Master Plan v2, R9.7) lives here rather than on
   * the map toolbar — a player sets their own token's drop behavior from the
   * sheet they're already looking at, instead of hunting for it in the map
   * tools rail. Shared with `VectorMapView` via the same `MapToolController`
   * (`mapCtrl.tokenSnap`), so a drag-drop on the map reads whatever was set
   * here. */
  const mapCtrl = getContext<MapToolController>(MAP_TOOL_KEY);

  const rows = $derived(buildProfileRows(template, profile));

  // A fresh seat has no `portraitRef` yet — falls back to the same
  // generated colored-circled-letter default the token layer uses (Gate 9:
  // "a fresh seat automatically has a colored circled-letter token/portrait").
  const myColor = $derived(profile?.color);
  const storedPortraitRef = $derived(profile?.portraitRef || defaultPortraitRef(players, seatId));
  /** What the preview actually shows. A letter portrait bakes its color into
   * the ref itself, so the picked color is applied here rather than waiting on
   * a stored rewrite — the swatch and the disc above it can never disagree
   * mid-write (playtest feedback: the preview didn't follow the colour). An
   * uploaded/bundled portrait keeps its art and gets the colour as the disc
   * behind it, exactly like the map token. */
  const portraitRef = $derived.by(() => {
    const gen = parseGenTokenRef(storedPortraitRef);
    return gen && myColor ? buildGenTokenRef(gen.label, myColor) : storedPortraitRef;
  });

  function setValue(fieldId: string, value: string | number | boolean): void {
    if (!seatId || readOnly) return;
    void store.setProfileValue(roomId, seatId, fieldId, value);
  }

  /**
   * A profile die button. Rolls immediately through the shared pipeline —
   * this used to `diceTray.stage()`, which silently loaded the tray and, with
   * the Roll sheet closed (always, on mobile), looked like a dead button.
   *
   * While a Call for Initiative is open it stages this character's slot
   * instead, and the card shows READY (Workflow 3).
   */
  /** The token this sheet's seat owns — the actor an initiative call stages
   * for in Individual mode. */
  const ownTokenId = $derived(tokens.find((t) => t.ownerSeatId === seatId)?.id);

  /**
   * Dragging the portrait onto the map places this character's token there.
   *
   * Allowed whenever this sheet is writable — which, under group ownership,
   * includes a groupmate's character, not only your own seat. A character with
   * no token yet is still draggable: the drop creates one where it lands,
   * rather than at the fixed spot "My token" uses.
   */
  const canDragToken = $derived(!readOnly && Boolean(seatId));

  function onPortraitDragStart(e: DragEvent): void {
    if (!canDragToken || !e.dataTransfer) return;
    writeTokenDrag(e.dataTransfer, {
      tokenId: ownTokenId ?? null,
      seatId,
      imageRef: portraitRef,
    });
    // The translucent portrait following the pointer *is* the feedback that the
    // token has been picked up — the map hides the real one meanwhile.
    setGhostImage(e, e.currentTarget as HTMLElement);
    mapCtrl.sheetDragTokenId = ownTokenId ?? null;
  }

  /** Fires whether or not the drop landed on the map, so a drag released over
   * nothing puts the token back rather than leaving it hidden. */
  function onPortraitDragEnd(): void {
    mapCtrl.sheetDragTokenId = null;
  }

  async function rollField(die: string, label: string): Promise<void> {
    await rollOrStage(
      store,
      roomId,
      myUid,
      String(die),
      {
        sharedRoll,
        mode: initiativeMode,
        ...(ownTokenId ? { refId: ownTokenId } : {}),
        ...(seatId ? { ownerUid: seatId } : {}),
      },
      conventions,
      label,
    );
  }

  let settingToken = $state(false);

  async function pickMyToken(): Promise<void> {
    if (settingToken) return;
    const picked = await dialogs.pickToken({
      title: 'My token',
      roomId,
      mode: 'portrait',
      confirmLabel: 'Set as my token',
      genDefaultLabel: seatLetterFor(players, seatId),
      genDefaultColorSeed: seatId,
    });
    if (!picked) return;
    settingToken = true;
    try {
      const ref = picked.ref || defaultPortraitRef(players, seatId);
      await store.setProfilePortrait(roomId, seatId, ref);
      const mine = tokens.find((t) => t.ownerSeatId === seatId);
      if (mine) {
        await store.setTokenImage(roomId, mine.id, ref);
      } else {
        await store.createToken(roomId, {
          pos: { x: 160 + tokens.length * DEFAULT_GRID_CONFIG.cellSize, y: 160 },
          size: 1,
          layer: 'tokens',
          imageRef: ref,
          ownerSeatId: seatId,
        });
      }
    } finally {
      settingToken = false;
    }
  }

  // Color is a selection independent of the token's image (Master Plan v2
  // addendum, quick-sheet token/color split): a background disc behind
  // whatever art the token has, and the character's default dice tint
  // (`characterDiceColor`, `apps/web/src/lib/dice/seat-color.ts`). Mirrored
  // onto Profile + the owner's map token in one gesture, like `pickMyToken`
  // mirrors the portrait ref.
  let settingColor = $state(false);

  async function setMyColor(color: string | undefined): Promise<void> {
    if (settingColor || readOnly) return;
    settingColor = true;
    try {
      await store.setProfileColor(roomId, seatId, color);
      // A stored letter *portrait* bakes its colour in the same way a letter
      // token does — rewrite it too, or the sheet's own preview would be the
      // only surface showing the new colour.
      if (color !== undefined && profile?.portraitRef) {
        const genPortrait = parseGenTokenRef(profile.portraitRef);
        if (genPortrait)
          await store.setProfilePortrait(
            roomId,
            seatId,
            buildGenTokenRef(genPortrait.label, color),
          );
      }
      const mine = tokens.find((t) => t.ownerSeatId === seatId);
      if (!mine) return;
      const writes: Promise<void>[] = [store.setTokenColor(roomId, mine.id, color)];
      // A letter token bakes its color into `imageRef` itself
      // (`gen:disc:{label}:{color}`) — rebuild it with the new color so the
      // disc art and the new `color` field never disagree (see
      // `parseGenTokenRef`'s doc comment).
      if (color !== undefined) {
        const gen = parseGenTokenRef(mine.imageRef);
        if (gen)
          writes.push(store.setTokenImage(roomId, mine.id, buildGenTokenRef(gen.label, color)));
      }
      await Promise.all(writes);
    } finally {
      settingColor = false;
    }
  }

  const selectedToken = $derived(tokens.find((t) => t.ownerSeatId === seatId));

  async function handleResizeToken(size: number): Promise<void> {
    if (!selectedToken) return;
    await store.resizeToken(roomId, selectedToken.id, size);
  }
</script>

<!--
  Renders ANY profileTemplate generically (Plan §2.5) — this component has
  no per-field-id logic and never inspects a value for game meaning. Only
  the field's declared `type` decides which control renders.
-->
<div class="dock" data-testid="character-dock">
  <div class="header">
    <!-- The colour also shows *behind* the art, so an uploaded portrait with
    transparency reads the same on the sheet as the token does on the map. -->
    <!-- Draggable onto the map: picks this character's token up off the map
    (it hides for the duration), carries a translucent copy of the portrait on
    the pointer, and drops it wherever it is released. See `onPortraitDragStart`. -->
    <img
      class="portrait"
      class:draggable={canDragToken}
      data-testid="dock-portrait"
      data-portrait-ref={portraitRef}
      style={myColor ? `background:${myColor}` : undefined}
      src={assets.resolve(portraitRef)}
      alt=""
      draggable={canDragToken}
      ondragstart={onPortraitDragStart}
      ondragend={onPortraitDragEnd}
    />
    <h2>Character</h2>
    {#if canSetOwnToken}
      <button
        class="my-token"
        data-testid="my-token"
        onclick={() => void pickMyToken()}
        disabled={settingToken}
      >
        My token
      </button>
    {/if}
  </div>
  {#if canSetOwnToken}
    <div class="token-color" data-testid="token-color-control">
      <span class="group-label">Color</span>
      <div class="swatches">
        {#each CHARACTER_COLOR_PALETTE as swatch, i (swatch)}
          <button
            type="button"
            class="swatch"
            class:selected={myColor === swatch}
            data-testid={`token-color-swatch-${i}`}
            style={`background:${swatch}`}
            aria-label={swatch}
            disabled={settingColor}
            onclick={() => void setMyColor(swatch)}
          ></button>
        {/each}
        <input
          type="color"
          data-testid="token-color-custom"
          value={myColor ?? '#888888'}
          disabled={settingColor}
          onchange={(e) => void setMyColor(e.currentTarget.value)}
        />
        {#if myColor}
          <button
            type="button"
            class="clear-color"
            data-testid="token-color-clear"
            disabled={settingColor}
            onclick={() => void setMyColor(undefined)}
          >
            Clear
          </button>
        {/if}
      </div>
    </div>
  {/if}
  <div class="map-defaults" data-testid="map-defaults">
    <span class="group-label">Map defaults</span>
    <label class="inline" data-testid="token-snap-control">
      Snap
      <select data-testid="token-snap-mode" bind:value={mapCtrl.tokenSnap}>
        <option value="cell">Cell</option>
        <option value="half">Half</option>
        <option value="free">Free</option>
      </select>
    </label>
    {#if selectedToken}
      <label class="inline" data-testid="token-scale-control">
        Token scale
        <input
          type="range"
          data-testid="token-scale-slider"
          min="1"
          max="3"
          step="1"
          value={selectedToken.size}
          disabled={readOnly}
          oninput={(e) => void handleResizeToken(Number((e.currentTarget as HTMLInputElement).value))}
        />
        <span data-testid="token-scale-value">{selectedToken.size}×{selectedToken.size}</span>
      </label>
    {/if}
  </div>
  {#each rows as row (row.field.id)}
    <div class="field" data-testid={`profile-field-${row.field.id}`}>
      <label for={`field-${row.field.id}`}>{row.field.label}</label>

      {#if row.field.type === 'text'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="text"
          value={row.value}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, e.currentTarget.value)}
        />
      {:else if row.field.type === 'longtext'}
        <textarea
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          value={String(row.value)}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, e.currentTarget.value)}
        ></textarea>
      {:else if row.field.type === 'number'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="number"
          value={row.value}
          disabled={readOnly}
          oninput={(e) => setValue(row.field.id, Number(e.currentTarget.value))}
        />
      {:else if row.field.type === 'counter'}
        <div class="counter">
          <button
            data-testid={`profile-counter-dec-${row.field.id}`}
            disabled={readOnly}
            onclick={() => setValue(row.field.id, Number(row.value) - 1)}>−</button
          >
          <span data-testid={`profile-counter-value-${row.field.id}`}>{row.value}</span>
          <button
            data-testid={`profile-counter-inc-${row.field.id}`}
            disabled={readOnly}
            onclick={() => setValue(row.field.id, Number(row.value) + 1)}>+</button
          >
        </div>
      {:else if row.field.type === 'checkbox'}
        <input
          id={`field-${row.field.id}`}
          data-testid={`field-input-${row.field.id}`}
          type="checkbox"
          checked={Boolean(row.value)}
          disabled={readOnly}
          onchange={(e) => setValue(row.field.id, e.currentTarget.checked)}
        />
      {:else if isDieField(row.field.type)}
        <button
          class="roll-chip"
          data-testid={`profile-roll-${row.field.id}`}
          onclick={() => void rollField(String(row.value), row.field.label)}
        >
          🎲 {row.value}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .dock {
    background: var(--bg-panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .dock h2 {
    margin: 0;
    font-size: 1rem;
    flex: 1;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.75rem;
  }
  .portrait {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--line-strong);
    flex-shrink: 0;
  }
  /* The one affordance saying the portrait can be thrown at the map. */
  .portrait.draggable {
    cursor: grab;
  }
  .my-token {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .my-token:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .token-color {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .swatches {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .swatch {
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    padding: 0;
    cursor: pointer;
  }
  .swatch.selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .swatch:disabled,
  input[type='color']:disabled,
  .clear-color:disabled {
    opacity: 0.5;
    cursor: default;
  }
  input[type='color'] {
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: none;
    cursor: pointer;
  }
  .clear-color {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .map-defaults {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
  }
  .group-label {
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .inline select {
    background: var(--bg-inset);
    color: inherit;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    padding: 0.2rem;
  }
  .field {
    margin-bottom: 0.6rem;
  }
  .field label {
    display: block;
    font-size: 0.75rem;
    opacity: 0.75;
    margin-bottom: 0.2rem;
  }
  .field input[type='text'],
  .field input[type='number'],
  .field textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .counter button {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    background: var(--bg-inset);
    color: inherit;
    cursor: pointer;
  }
  .roll-chip {
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-panel-alt);
    color: inherit;
    cursor: pointer;
  }
</style>
