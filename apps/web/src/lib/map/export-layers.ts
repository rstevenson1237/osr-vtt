/**
 * The render stack, bottom-up, as far as a PNG export can be cut off — mirrors
 * `vector-engine.ts`'s layer order (`background` → `floor` → grid → `overlay`
 * → `fog` → `tokens`; the never-persisted `tools` layer is never exported).
 *
 * Its own module so the map-tool controller and the toolbar can name a layer
 * without importing the Pixi engine, and the engine can honor one without
 * importing the controller.
 */
export const MAP_EXPORT_LAYERS = ['background', 'floor', 'overlay', 'fog', 'tokens'] as const;

export type MapExportLayer = (typeof MAP_EXPORT_LAYERS)[number];

/** Whether `layer` is at or below the export cutoff `maxLayer`. */
export function layerIncludedInExport(layer: MapExportLayer, maxLayer: MapExportLayer): boolean {
  return MAP_EXPORT_LAYERS.indexOf(layer) <= MAP_EXPORT_LAYERS.indexOf(maxLayer);
}
