<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import type { AccountInfo, CampaignStore, Unsubscribe } from '@osr-vtt/shared';
  import { CAMPAIGN_STORE_KEY } from '../context';

  /**
   * Google account linking / sign-in affordance (Master Plan v2, R6.1).
   * Deliberately optional and non-blocking — "never a login wall". Two
   * placements share one control:
   *  - `room` (Session tab): an anonymous seat can "Save identity" to link its
   *    *current* uid to Google in place (so a GM keeps their room); a linked
   *    seat sees its email + can sign out.
   *  - `lobby`: a fresh device can "Sign in with Google" to *recover* a linked
   *    uid (⇒ GM recovery) and see its My Rooms again.
   * Players may ignore all of this and stay anonymous forever.
   */
  let { placement = 'room' }: { placement?: 'room' | 'lobby' } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);

  let account = $state<AccountInfo | null>(null);
  let busy = $state(false);
  let error = $state('');
  // The one specifically-handled link failure: the chosen Google account is
  // already bound to a *different* uid (Master Plan v2, R6.1). We offer
  // sign-in-instead, which switches identity — no silent merge in v1.
  let conflict = $state(false);

  let unsub: Unsubscribe | null = null;
  onMount(() => {
    unsub = store.subscribeAuth((a) => (account = a));
  });
  onDestroy(() => unsub?.());

  const isAnonymous = $derived(account?.isAnonymous ?? true);
  const label = $derived(account?.email ?? account?.displayName ?? '');

  async function link(): Promise<void> {
    if (busy) return;
    busy = true;
    error = '';
    conflict = false;
    try {
      const res = await store.linkWithGoogle();
      if (!res.ok) {
        if (res.reason === 'credential-already-in-use') conflict = true;
        else if (res.reason !== 'cancelled') error = res.message ?? 'Could not save identity';
      }
    } finally {
      busy = false;
    }
  }

  async function signIn(): Promise<void> {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await store.signInWithGoogle();
      conflict = false;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        error = err instanceof Error ? err.message : 'Sign-in failed';
      }
    } finally {
      busy = false;
    }
  }

  async function signOut(): Promise<void> {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await store.signOutToAnonymous();
    } finally {
      busy = false;
    }
  }
</script>

<div class="account" class:lobby={placement === 'lobby'} data-testid="account-controls">
  {#if account && !isAnonymous}
    <span class="who" data-testid="account-email" title={label}>
      Signed in{label ? ` as ${label}` : ''}
    </span>
    <button class="link-btn" data-testid="account-signout" onclick={signOut} disabled={busy}>
      Sign out
    </button>
  {:else if placement === 'lobby'}
    <span class="hint">Sign in to see rooms saved to your account.</span>
    <button class="link-btn" data-testid="account-signin" onclick={signIn} disabled={busy}>
      {busy ? 'Signing in…' : 'Sign in with Google'}
    </button>
  {:else}
    <button class="link-btn" data-testid="account-link" onclick={link} disabled={busy} title="Link this identity to Google so you can recover it on another device">
      {busy ? 'Saving…' : 'Save identity'}
    </button>
  {/if}

  {#if conflict}
    <div class="conflict" data-testid="account-conflict">
      <span>That Google account is already used by another identity.</span>
      <button class="link-btn warn" data-testid="account-signin-instead" onclick={signIn} disabled={busy}>
        Sign in instead
      </button>
      <span class="warn-note">This switches who you are — your current anonymous seat is left behind.</span>
    </div>
  {/if}
  {#if error}
    <span class="error" data-testid="account-error">{error}</span>
  {/if}
</div>

<style>
  .account {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-size: 0.72rem;
  }
  .account.lobby {
    font-size: 0.85rem;
    gap: 0.6rem;
  }
  .who {
    color: var(--text-dim);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    color: var(--text-dim);
  }
  .link-btn {
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 0.15rem 0.55rem;
    background: transparent;
    color: var(--accent-text);
    cursor: pointer;
    font: inherit;
  }
  .link-btn:hover:not(:disabled) {
    color: var(--text);
  }
  .link-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .link-btn.warn {
    color: var(--failure);
    border-color: var(--failure);
  }
  .conflict {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex-basis: 100%;
    background: var(--bg-inset);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 0.4rem 0.55rem;
  }
  .warn-note {
    color: var(--text-dim);
  }
  .error {
    color: var(--failure);
  }
</style>
