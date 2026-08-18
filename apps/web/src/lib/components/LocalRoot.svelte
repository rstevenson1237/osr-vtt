<script lang="ts">
  import type { LocalStore } from '@osr-vtt/shared';
  import LocalCampaign from './LocalCampaign.svelte';
  import LocalLobby from './LocalLobby.svelte';

  /**
   * The local build's root (SPEC-041 §§1, 5). It has exactly two states — no
   * campaign open, or one open — because that is all local mode has: one
   * referee, one file. There is no routing here on purpose: a room id in the
   * URL is a hosted concept (it is the capability, RULE-012), and a local
   * campaign has no id worth sharing and nothing to share it with.
   */
  let session = $state<{ store: LocalStore; roomId: string } | null>(null);

  async function closeCampaign(): Promise<void> {
    const open = session;
    session = null;
    if (!open) return;
    // Only autosaving files are written on the way out. A fallback file's
    // "write" is a download, and closing a campaign is not the moment to push
    // one at somebody who did not ask — the Save control does that.
    if (open.store.saveState().autosave) {
      try {
        await open.store.flush();
      } catch {
        // The campaign is closing either way; the save indicator has already
        // reported the failure, and there is no surface left to report it on.
      }
    }
    open.store.dispose();
  }
</script>

{#if session}
  {#key session.roomId}
    <LocalCampaign store={session.store} roomId={session.roomId} onClose={closeCampaign} />
  {/key}
{:else}
  <LocalLobby onOpened={(opened) => (session = opened)} />
{/if}
