/** User-facing copy for VectorMapView (SPEC-055 §5). */
export const VectorMapViewStrings = {
  roomName: 'Room name\u2026',
  addCreatureTitle: 'Add creature',
  addCreatureConfirm: 'Add',
  addTextTitle: 'Add text',
  addTextLabel: 'Text',
  addTextConfirm: 'Place',
  floorExtentBlocked: (max: number) =>
    `Carve blocked — the floor would exceed the ${max}-unit max extent. Undo or carve a smaller area.`,
  fogCarveHint: (reveal: boolean) =>
    `${reveal ? 'Reveal' : 'Hide'} fog — click a carved area to ${reveal ? 'show that whole room to the players' : 'fog that whole room again'}, or draw a shape to ${reveal ? 'reveal' : 're-fog'} just part of it.`,
  toolHints: {
      select:
        'Select — click a vertex to drag it, or an object to move it; drag over open canvas to lasso both. Backspace deletes everything selected.',
      pan: 'Pan — drag to move the view (also available on any tool via right-click drag, Alt+drag, or Space+drag).',
      measure: 'Measure — drag from one point to another to read the distance between them.',
      room: 'Room — drag two corners, or click to start and click again to finish. Hold Alt for freeform corners.',
      corridor: 'Corridor — drag start→end for an L-shaped run of fixed Width.',
      path: 'Path — click to add points, double-click (or Enter) to finish. Rock mode carves an interior divider.',
      polygon: 'Polygon — click each vertex, double-click (or Enter) to close.',
      ngon: 'Regular n-gon — drag center→radius. Sides=1 ⇒ circle.',
      carve:
        'Carve — drag to paint. Snap picks the shape: Cell/Half paint whole lattice cells, Free paints a smooth ribbon of the chosen Width.',
      wall: 'Wall — click points, double-click (or Enter) to finish. Explicit sight+movement blocker.',
      door: 'Door — click two endpoints on/near a wall. Click an existing door to toggle open/closed.',
      eye: 'Eye — click to preview line of sight from a point.',
      pen: 'Pen — drag to draw a freehand note on the overlay layer.',
      ping: 'Ping — click to drop a transient marker all players see.',
      label: 'Label — click to place a keyed room label, then type its name.',
      symbol: 'Symbol — click to place the selected symbol.',
      text: 'Text — click to place, then type the string.',
      capture:
        'Capture — drag two corners, or click to start and click again to finish. Always whole cells, for the battle map you cut out.',
      hexSymbol:
        'Symbol — click to place the selected symbol. Hex snap lands on the hex the pointer is inside; Free snap lands exactly where you clicked.',
      road: 'Road — click each point, double-click (or Enter) to finish. Hex snap resolves each vertex to the nearest hex corner or centre.',
      river:
        'River — click each point, double-click (or Enter) to finish. Hex snap resolves each vertex to the nearest hex corner or centre.',
      hexLabel: 'Label — click a hex to open its note.',
      hexTerrain:
        'Terrain — click a hex to paint the selected terrain; click a hex that already has it to clear it.',
      hexFog:
        'Reveal / Hide hex — click or drag across hexes. Starting on a fogged hex reveals everything you cross; starting on a revealed one hides it again.',
  },
} as const;
