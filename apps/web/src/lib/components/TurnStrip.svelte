<script lang="ts">
  import { getContext } from 'svelte';
  import {
    initiativeActors,
    type CampaignStore,
    type Encounter,
    type EncounterMode,
    type Group,
    type ProfileInstance,
    type ProfileTemplateField,
    type SharedRoll,
    type Token,
  } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { refLabel } from '../encounter/labels';

  /** Compact "Round N · X is up" readout, now in the top status bar so the
   * shared initiative/round state stays visible on *every* stage, not just
   * the map (Encounter Screen Spec §9 — switching Main Stage mode never loses
   * encounter state). Read-only; all editing happens on the Board.
   *
   * SPEC-050 §2: it's also the one place a Call for Initiative is visible off
   * the Encounter board — before this, `combat-staging-note` rendered inside
   * `CombatTracker` alone, so a player on the Map view saw their die button
   * behave differently with no explanation. */
  let {
    roomId,
    encounter,
    groups,
    tokens,
    gmUid = '',
    initiativeDie = 'd6',
    initiativeMode = 'side',
    profileTemplate = [],
    profiles = [],
    encounterTemplate = [],
  }: {
    roomId: string;
    encounter: Encounter | null;
    groups: Group[];
    tokens: Token[];
    gmUid?: string;
    initiativeDie?: string;
    initiativeMode?: EncounterMode;
    profileTemplate?: ProfileTemplateField[];
    profiles?: ProfileInstance[];
    encounterTemplate?: ProfileTemplateField[];
  } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let sharedRoll = $state<SharedRoll | null>(null);
  $effect(() => store.subscribeSharedRoll(roomId, (sr) => (sharedRoll = sr)));

  const callOpen = $derived(sharedRoll?.kind === 'initiative' && sharedRoll.status === 'staging');

  const actors = $derived(
    initiativeActors({
      mode: initiativeMode,
      groups,
      tokens,
      gmUid,
      defaultDie: initiativeDie,
      profileTemplate,
      profiles,
      encounterTemplate,
      encounterValues: encounter?.values,
    }),
  );

  const readyCount = $derived(
    Object.values(sharedRoll?.slots ?? {}).filter((slot) => slot.ready).length,
  );

  const currentEntry = $derived(
    encounter && encounter.order.length > 0
      ? (encounter.order[encounter.currentIndex] ?? null)
      : null,
  );
</script>

{#if encounter && (currentEntry || callOpen)}
  <div class="turn-strip" data-testid="turn-strip">
    {#if currentEntry}
      <span class="round" data-testid="turn-strip-round">Round {encounter.round}</span>
      <span class="current" data-testid="turn-strip-current"
        >{refLabel(currentEntry, groups, tokens)} is up</span
      >
    {/if}
    {#if callOpen}
      <span class="call" data-testid="turn-strip-call"
        >Initiative called — {readyCount} of {actors.length} ready</span
      >
    {/if}
  </div>
{/if}

<style>
  /* An inline pill in the top status bar — the only placement there is. The
     floating-over-the-map `stage` variant it used to share this rule with was
     unreachable (every call site passed `rail`), so its positioning and the
     variant prop are both gone. */
  .turn-strip {
    display: flex;
    gap: 0.6rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    background: var(--bg-panel);
    border: 1px solid var(--line);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  .round {
    font-weight: 600;
  }
</style>
