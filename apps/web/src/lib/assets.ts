import { STARTER_MAP_REF } from '@osr-vtt/shared';

/**
 * The bundled asset **refs** — the constants every activity panel and dialog
 * names. Constructing the `AssetStore` itself is not this module's job and
 * never was this module's to re-derive: it is a concrete-store decision, so it
 * lives in the build's store touchpoint (`firebase/client.ts` hosted,
 * `firebase/client.local.ts` local — RULE-001, SPEC-041 §6). Keeping it here
 * would have pulled the Firebase SDK into a local build through a module whose
 * whole content is four string constants.
 */

// The canonical starter map ref lives in `@osr-vtt/shared` (the v9->v10
// background migration and store defaults seed it); re-exported here so the
// web app's existing `../../assets` imports keep working unchanged.
export { STARTER_MAP_REF };
export const STARTER_TOKEN_REFS = ['tokens/fighter.svg', 'tokens/goblin.svg'] as const;
// (The old `DICE_FACE_REF` d6 face SVGs were retired in WI-4: the dice renderer
// v2 generates every die's number faces procedurally on a canvas per R3.2, so
// no dice textures are loaded from the bundle anymore.)

/** Bundled sample fixtures for Phase 4 (referee engine + FoW LoS). */
export const SAMPLE_UVTT_REF = 'maps/sample-dungeon.dd2vtt';
export const SAMPLE_TABLE_REFS = [
  { ref: 'tables/wandering-monsters.json', kind: 'json' as const },
  { ref: 'tables/treasure.csv', kind: 'csv' as const },
];
