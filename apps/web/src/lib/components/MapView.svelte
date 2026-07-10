<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import * as PIXI from 'pixi.js';
  import type { AssetStore, CampaignStore, Token } from '@osr-vtt/shared';
  import { ASSET_STORE_KEY, CAMPAIGN_STORE_KEY } from '../context';
  import { STARTER_MAP_REF, STARTER_TOKEN_REFS } from '../assets';

  let { roomId, tokens, isGM }: { roomId: string; tokens: Token[]; isGM: boolean } = $props();

  const store = getContext<CampaignStore>(CAMPAIGN_STORE_KEY);
  const assets = getContext<AssetStore>(ASSET_STORE_KEY);

  const TOKEN_PX = 48;
  // A fixed, canvas-safe drop position near the top-left of the starter map
  // — guaranteed visible without panning/zooming regardless of viewport
  // size, so the first token is always immediately clickable/draggable.
  const STARTER_DROP_POS = { x: 160, y: 160 };

  let hostEl: HTMLDivElement;
  let app: PIXI.Application | null = null;
  let world: PIXI.Container | null = null;
  const spritesByToken = new Map<string, PIXI.Sprite>();
  const draggingIds = new Set<string>();
  let ready = $state(false);
  let dropping = $state(false);

  onMount(() => {
    let disposed = false;
    void (async () => {
      const application = new PIXI.Application();
      await application.init({
        backgroundColor: 0x14110d,
        resizeTo: hostEl,
        antialias: true,
      });
      if (disposed) {
        application.destroy();
        return;
      }
      app = application;
      hostEl.appendChild(application.canvas);

      const worldContainer = new PIXI.Container();
      world = worldContainer;
      application.stage.addChild(worldContainer);

      const bgTexture = await PIXI.Assets.load(assets.resolve(STARTER_MAP_REF));
      const bg = new PIXI.Sprite(bgTexture as PIXI.Texture);
      worldContainer.addChild(bg);

      setupPanZoom(application, worldContainer);
      ready = true;
      syncSprites(tokens);
    })();

    return () => {
      disposed = true;
    };
  });

  onDestroy(() => {
    app?.destroy(true, { children: true });
    app = null;
    world = null;
  });

  function setupPanZoom(application: PIXI.Application, worldContainer: PIXI.Container): void {
    application.stage.eventMode = 'static';
    application.stage.hitArea = application.screen;

    let panning = false;
    let lastX = 0;
    let lastY = 0;

    application.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (e.target !== application.stage) return; // token sprites own their own drag
      panning = true;
      lastX = e.global.x;
      lastY = e.global.y;
    });
    application.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!panning) return;
      worldContainer.x += e.global.x - lastX;
      worldContainer.y += e.global.y - lastY;
      lastX = e.global.x;
      lastY = e.global.y;
    });
    const stopPan = () => {
      panning = false;
    };
    application.stage.on('pointerup', stopPan);
    application.stage.on('pointerupoutside', stopPan);

    application.canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        worldContainer.scale.set(worldContainer.scale.x * factor);
      },
      { passive: false },
    );
  }

  $effect(() => {
    if (ready) syncSprites(tokens);
  });

  function syncSprites(list: Token[]): void {
    if (!world) return;
    const seen = new Set<string>();
    for (const token of list) {
      seen.add(token.id);
      let sprite = spritesByToken.get(token.id);
      if (!sprite) {
        sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        sprite.anchor.set(0.5);
        sprite.eventMode = 'static';
        sprite.cursor = 'grab';
        attachDragHandlers(sprite, token.id);
        world.addChild(sprite);
        spritesByToken.set(token.id, sprite);
        void loadTokenTexture(sprite, token.imageRef);
      }
      // Don't fight an in-progress local drag with the last settled
      // Firestore position — only snap when this client isn't dragging it.
      if (!draggingIds.has(token.id)) {
        sprite.position.set(token.pos.x, token.pos.y);
      }
      sprite.width = TOKEN_PX * token.size;
      sprite.height = TOKEN_PX * token.size;
    }
    for (const [id, sprite] of spritesByToken) {
      if (!seen.has(id)) {
        sprite.destroy();
        spritesByToken.delete(id);
      }
    }
  }

  async function loadTokenTexture(sprite: PIXI.Sprite, imageRef: string): Promise<void> {
    const texture = await PIXI.Assets.load(assets.resolve(imageRef));
    sprite.texture = texture as PIXI.Texture;
  }

  function attachDragHandlers(sprite: PIXI.Sprite, tokenId: string): void {
    let dragging = false;
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      dragging = true;
      draggingIds.add(tokenId);
      sprite.cursor = 'grabbing';
      e.stopPropagation();
    });
    sprite.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragging || !world) return;
      const local = world.toLocal(e.global);
      sprite.position.set(local.x, local.y);
      store.publishDrag(roomId, tokenId, { x: local.x, y: local.y });
    });
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      draggingIds.delete(tokenId);
      sprite.cursor = 'grab';
      void store.moveToken(roomId, tokenId, { x: sprite.position.x, y: sprite.position.y });
      store.clearDrag(roomId, tokenId);
    };
    sprite.on('pointerup', stop);
    sprite.on('pointerupoutside', stop);
  }

  async function dropStarterToken(): Promise<void> {
    if (dropping) return;
    dropping = true;
    try {
      await store.createToken(roomId, {
        pos: { ...STARTER_DROP_POS },
        size: 1,
        layer: 'tokens',
        imageRef: STARTER_TOKEN_REFS[0],
      });
    } finally {
      dropping = false;
    }
  }
</script>

<div class="map-view" data-testid="map-canvas" bind:this={hostEl}>
  {#if isGM && tokens.length === 0}
    <button
      class="drop-token"
      data-testid="drop-token"
      onclick={dropStarterToken}
      disabled={dropping}
    >
      Drop starter token
    </button>
  {/if}

  <div class="token-readout" aria-hidden="true">
    {#each tokens as token (token.id)}
      <span data-testid={`token-pos-${token.id}`}
        >{token.pos.x.toFixed(0)},{token.pos.y.toFixed(0)}</span
      >
    {/each}
  </div>
</div>

<style>
  .map-view {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .drop-token {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 2;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    border: none;
    background: #a6763f;
    color: #14110d;
    font-weight: 600;
    cursor: pointer;
  }
  .token-readout {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
</style>
