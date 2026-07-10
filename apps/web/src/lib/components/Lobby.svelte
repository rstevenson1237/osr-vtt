<script lang="ts">
  import { getContext } from 'svelte';
  import type { CampaignStore } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';
  import { navigateToRoom } from '../routes';
  import { STARTER_PROFILE_TEMPLATE } from '../profile/starter-template';

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let roomName = $state('');
  let password = $state('');
  let creating = $state(false);
  let createError = $state('');

  let joinRoomId = $state('');

  async function createRoom() {
    if (!roomName.trim() || creating) return;
    creating = true;
    createError = '';
    try {
      const roomId = await store.createRoom({
        name: roomName.trim(),
        profileTemplate: STARTER_PROFILE_TEMPLATE,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      navigateToRoom(roomId);
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create room';
    } finally {
      creating = false;
    }
  }

  function joinExistingRoom() {
    if (!joinRoomId.trim()) return;
    navigateToRoom(joinRoomId.trim());
  }
</script>

<div class="lobby">
  <h1>OSR VTT</h1>

  <section>
    <h2>Create room as Referee</h2>
    <label>
      Room name
      <input data-testid="create-room-name" bind:value={roomName} placeholder="The Sunless Vault" />
    </label>
    <label>
      Room password <span class="hint">(optional — stored for later, not enforced yet)</span>
      <input data-testid="create-room-password" type="password" bind:value={password} />
    </label>
    <button data-testid="create-room-submit" onclick={createRoom} disabled={creating}>
      {creating ? 'Creating…' : 'Create room'}
    </button>
    {#if createError}
      <p class="error">{createError}</p>
    {/if}
  </section>

  <section>
    <h2>Join a room</h2>
    <label>
      Room ID or link
      <input data-testid="join-room-id" bind:value={joinRoomId} placeholder="Paste a room ID" />
    </label>
    <button data-testid="join-room-go" onclick={joinExistingRoom}>Go to room</button>
  </section>
</div>

<style>
  .lobby {
    max-width: 480px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  section {
    background: #241f18;
    border: 1px solid #3a3226;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
  }
  label {
    display: block;
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }
  input {
    display: block;
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #4a4030;
    background: #14110d;
    color: inherit;
  }
  button {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: none;
    background: #a6763f;
    color: #14110d;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .hint {
    opacity: 0.6;
    font-weight: normal;
  }
  .error {
    color: #e08080;
  }
</style>
