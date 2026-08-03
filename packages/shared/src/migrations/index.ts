import { assignedCharacterColor } from '../character-color.js';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_ENCOUNTER_TEMPLATE,
  DEFAULT_BACKGROUND,
  DEFAULT_GRID_CONFIG,
  DEFAULT_GRID_SETTINGS,
  DEFAULT_HANDOUT,
  DEFAULT_MEASURE,
  DEFAULT_ROLL_CONVENTIONS,
  DEFAULT_ROOM_SETTINGS,
} from '../types.js';

/** The v3->v4 migration only ever backfills `theme` — pulling it off the
 * shared default keeps that one field in sync with `DEFAULT_ROOM_SETTINGS`
 * without also injecting `measure`, which is the v4->v5 step's job alone. */
const DEFAULT_THEME = DEFAULT_ROOM_SETTINGS.theme;

/**
 * schemaVersion + migrations scaffold (Plan §5, §8.10).
 *
 * `rooms/{roomId}.schemaVersion` records which shape a room doc is in.
 * A migration is a pure function that takes a room-doc-shaped object one
 * version forward. `migrateRoom` walks a doc forward from its stored version
 * to `CURRENT_SCHEMA_VERSION`, applying each migration in turn, so an
 * imported/loaded `.vttcamp` room (Plan §5) or an emulator-seeded doc from an
 * older build never gets silently misread.
 *
 * There are no real migrations yet (schema v1 is the first shape) — this
 * file exists so schema drift never orphans a saved campaign later. Add a
 * new entry to `migrations` every time CURRENT_SCHEMA_VERSION is bumped.
 */

export interface Migration {
  from: number;
  to: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

export const migrations: Migration[] = [
  // v1 -> v2 (Phase 1, Map Tooling Spec §7): rooms gain `grid`. Any v1 room
  // predates the cellular map model, so it gets the same grid default a
  // freshly created room would (Plan §11: square grid only). (This step
  // historically also seeded a `fog` field; fog was removed in the vector
  // cutover — SPEC §4 — so it is no longer written.)
  {
    from: 1,
    to: 2,
    migrate: (data) => ({
      ...data,
      grid: data['grid'] ?? DEFAULT_GRID_CONFIG,
    }),
  },
  // v2 -> v3 (Phase 5, Plan §7): rooms gain `handout`, the "reveal image to
  // players" pointer. A v2 room predates handouts, so nothing is revealed —
  // same default a freshly created room would seed.
  {
    from: 2,
    to: 3,
    migrate: (data) => ({
      ...data,
      handout: data['handout'] ?? DEFAULT_HANDOUT,
    }),
  },
  // v3 -> v4 (Master Plan v2, R2/WI-1): rooms gain `settings.theme`. A v3
  // room predates theming, so it gets the same default a freshly created
  // room would (`parchment-dark` — the current look, unchanged visually).
  {
    from: 3,
    to: 4,
    migrate: (data) => {
      const settings = (data['settings'] as Record<string, unknown> | undefined) ?? {};
      return {
        ...data,
        settings: { ...settings, theme: settings['theme'] ?? DEFAULT_THEME },
      };
    },
  },
  // v4 -> v5 (Master Plan v2, R9.3): rooms gain `settings.measure`. A v4 room
  // predates configurable units, so it gets the new default of 10/feet —
  // deliberately replacing the old implicit 5-ft assumption baked into the
  // ruler UI (per referee preference; see `map/ruler.ts`).
  {
    from: 4,
    to: 5,
    migrate: (data) => {
      const settings = (data['settings'] as Record<string, unknown> | undefined) ?? {};
      return {
        ...data,
        settings: { ...settings, measure: settings['measure'] ?? DEFAULT_MEASURE },
      };
    },
  },
  // v5 -> v6 (Master Plan v2, R9.6): rooms gain `settings.grid` (the half-grid
  // subdivision toggle). A v5 room predates it, so it gets the default (full
  // grid only — no visual change until a GM turns subdivision on).
  {
    from: 5,
    to: 6,
    migrate: (data) => {
      const settings = (data['settings'] as Record<string, unknown> | undefined) ?? {};
      return {
        ...data,
        settings: { ...settings, grid: settings['grid'] ?? DEFAULT_GRID_SETTINGS },
      };
    },
  },
  // v6 -> v7 (Master Plan v2, R8.1): `profileTemplate` fields gain a `pinned`
  // boolean (the actor-card pinned-fields flag). A v6 room predates it, so
  // every existing field is backfilled `pinned: false` — nothing pins to the
  // card until a GM turns it on. A field that already carries `pinned` (a
  // fresh export) keeps its value.
  {
    from: 6,
    to: 7,
    migrate: (data) => {
      const template = Array.isArray(data['profileTemplate']) ? data['profileTemplate'] : [];
      return {
        ...data,
        profileTemplate: template.map((field) => {
          const f = field as Record<string, unknown>;
          return { ...f, pinned: f['pinned'] ?? false };
        }),
      };
    },
  },
  // v7 -> v8 (Master Plan v2, R10.1/R10.2): the `WallStyle` union widens from
  // `'masonry' | 'natural'` to `'solid' | 'masonry' | 'natural' | 'dashed'`,
  // grid walls gain an optional per-wall `style`, and a new `circleWalls`
  // collection appears. This is a documentation-only bump: existing rooms'
  // `wallStyle` values are already members of the widened union, existing
  // walls carry no `style` (so they keep deriving from the room), and there's
  // no `circleWalls` data to backfill. Nothing on the room doc changes —
  // mirrors the R10.2 "records the new version, no data rewrite" pattern.
  {
    from: 7,
    to: 8,
    migrate: (data) => ({ ...data }),
  },
  // v8 -> v9 (Master Plan v2, R11.1/WI-15): the door model changes from the
  // boolean-ish `{ state, secret }` to a typed `{ type, state, facing? }`.
  // Doors live in wall *subcollection* docs (`walls/{edgeId}`, `sightWalls`),
  // not on the room doc, so the real per-door transform runs at the schema
  // read boundary (`MapDoorSchema`'s preprocess: `secret:true → 'secret'`,
  // else `'single'`) — nothing on the room doc itself changes here. This bump
  // is documentation-only, mirroring the R10.2 v7->v8 pattern.
  {
    from: 8,
    to: 9,
    migrate: (data) => ({ ...data }),
  },
  // v9 -> v10 (Master Plan v2, R15/WI-19): the background stops being a
  // hard-coded sprite and becomes a managed `Room.background` property. A v9
  // room rendered the starter map unconditionally, so it's backfilled with
  // `{ ref: STARTER_MAP_REF }` — visually identical to before. A GM can later
  // change it or clear it to `null` (bare rock). A room that already carries
  // `background` (a fresh export) keeps its value, including an explicit
  // `null`, so a cleared background survives a round-trip.
  {
    from: 9,
    to: 10,
    migrate: (data) => ({
      ...data,
      background: 'background' in data ? data['background'] : DEFAULT_BACKGROUND,
    }),
  },
  // v10 -> v11 (Master Plan v2, R17.3): multiple full map builds per session.
  // `grid`/`background`/`settings.measure`/`settings.grid` move off the room
  // doc onto a new `maps/{mapId}` doc, and the room gains `activeMapId`
  // pointing at it. That's a real data move (new doc + copied subcollections),
  // which this migration step — a pure, synchronous room-doc transform — can't
  // perform; it only bumps the version. The actual adoption (creating the
  // room's first `GameMap` from its pre-migration `grid`/`background`/
  // `settings.measure`/`settings.grid` and moving its cellular-map
  // subcollections under it) is `FirebaseStore.ensureActiveMap`, run once by
  // the GM's client when it opens a room with no `activeMapId` yet. The old
  // fields left on the doc here are harmless — `RoomSchema`/`RoomSettingsSchema`
  // silently drop unrecognized keys on parse — and `ensureActiveMap` reads them
  // straight off the raw pre-migration doc before they'd ever be dropped.
  {
    from: 10,
    to: 11,
    migrate: (data) => ({ ...data }),
  },
  // v11 -> v12 (dungeon-symbol art pack): `MapSymbol` gains an optional
  // `cellSpan` for multi-cell art (2x2 stair landings, 3x1 table sets), and
  // `Door` gains an optional `art` (which door-art catalog piece to render,
  // independent of the existing `type`, which still drives LoS/secret
  // semantics). Both live in subcollections (`maps/{mapId}/symbols/{id}`,
  // `maps/{mapId}/doors/{id}`), not on the room doc, so there's no room-doc
  // field to backfill here — the real defaults (1x1 span; art keyed off
  // `type`) live at the schema/render boundary. Documentation-only bump,
  // mirroring the v7->v8/v8->v9/v10->v11 pattern above.
  {
    from: 11,
    to: 12,
    migrate: (data) => ({ ...data }),
  },
  // v12 -> v13 (character quick-sheet token/color split): `Token` and
  // `ProfileInstance` each gain an optional `color` (`#rrggbb`) — a
  // background disc color behind a token's image (visible through a
  // transparent uploaded image and behind the letter-token disc alike), and
  // the character's own color that mirrors onto it. Also the *only* source of
  // that seat's dice color; while unset the renderer paints one theme-wide
  // neutral (`--dice-face`) — the `seatColor` seat-id hash that used to be the
  // fallback was removed. Both fields live in subcollections
  // (`rooms/{roomId}/tokens/{id}`, `rooms/{roomId}/profiles/{seatId}`), not
  // on the room doc, so there's no room-doc field to backfill — absence is a
  // valid, already-handled state at the schema/render boundary.
  // Documentation-only bump, mirroring the v11->v12 pattern above.
  {
    from: 12,
    to: 13,
    migrate: (data) => ({ ...data }),
  },
  // v13 -> v14 (encounter profile): the room doc gains `encounterTemplate`, a
  // second `ProfileTemplateField[]` alongside `profileTemplate` — same field
  // types, same editor, but describing the encounter itself rather than a
  // seat. Unlike the documentation-only bumps above this one backfills a real
  // room-doc field, so an un-migrated doc is seeded with
  // DEFAULT_ENCOUNTER_TEMPLATE — the Difficulty/Danger/Clock widgets it
  // already had, now as ordinary editable template fields. A room that
  // somehow already carries a template keeps it untouched.
  {
    from: 13,
    to: 14,
    migrate: (data) => ({
      ...data,
      encounterTemplate: Array.isArray(data.encounterTemplate)
        ? data.encounterTemplate
        : DEFAULT_ENCOUNTER_TEMPLATE,
    }),
  },
  // v14 -> v15 (fog of war, vector-native): `GameMap` gains an optional
  // `fog: { enabled }`, and each map gains a `fogRegions` subcollection
  // holding the *revealed* geometry in the same shape as `floorRegions`.
  //
  // This is NOT a revival of the cellular `fog` field deleted in the WI-D
  // cutover (that was a mode enum over `fogChunks`; both are gone for good —
  // see `docs/VTT_Master_Plan.md` Part II §2, fog). Nothing is backfilled: a map with no
  // `fog` field has fog off, which is the correct reading for every map that
  // predates the feature, and an absent `fogRegions` collection is an empty
  // one. The field lives on `maps/{mapId}`, not the room doc, so as with the
  // v11->v12 / v12->v13 pattern there is no room-doc field to seed here.
  {
    from: 14,
    to: 15,
    migrate: (data) => ({ ...data }),
  },
  // v15 -> v16 (encounter/initiative/dice revamp). Backfills three real
  // room-doc fields, so unlike the documentation-only bumps above this one
  // does work:
  //
  //  - `rollConventions`: the referee-authored result bands. Seeded with
  //    DEFAULT_ROLL_CONVENTIONS, which is the *same* 4+/2-3/1 rule the app
  //    always applied — but scoped `{mode:'separate', sides:6}`, so behaviour
  //    for d6 is unchanged while a d20 face of 4 stops reporting "success".
  //  - `settings.initiativeMode`: seeded 'side', matching the historical
  //    DEFAULT_ENCOUNTER.mode, so a migrated room runs exactly as before.
  //  - `settings.initiativeDie`: seeded 'd6', matching the die the deleted
  //    `rollInitiative(dieMax = 6)` hardcoded.
  //
  // A room that somehow already carries any of these keeps it untouched.
  // `Encounter.pinnedRefIds`, `SharedRoll.kind` and `LogEntry.rollId` are all
  // additive fields on *subcollection* docs, so — per the v11->v12 / v14->v15
  // precedent — there is nothing on the room doc to seed for them and absence
  // is already their correct reading.
  {
    from: 15,
    to: 16,
    migrate: (data) => {
      const settings =
        typeof data.settings === 'object' && data.settings !== null
          ? (data.settings as Record<string, unknown>)
          : {};
      return {
        ...data,
        rollConventions: Array.isArray(data.rollConventions)
          ? data.rollConventions
          : DEFAULT_ROLL_CONVENTIONS,
        settings: {
          ...settings,
          initiativeMode: settings.initiativeMode ?? DEFAULT_ROOM_SETTINGS.initiativeMode,
          initiativeDie: settings.initiativeDie ?? DEFAULT_ROOM_SETTINGS.initiativeDie,
        },
      };
    },
  },
  // v16 -> v17: group ownership. Authority moves from `Token.ownerSeatId` (which
  // never gated anything) to `Group.memberSeatIds`, and a referee chooses where
  // newly joined seats land via `settings.defaultPlayerGroup`.
  //
  // Only the room-doc half needs seeding. `Group.memberSeatIds` and
  // `PlayerSeat.currentCharacterSeatId` are additive fields on *subcollection*
  // docs, so — per the v11->v12 / v14->v15 precedent — absence is already their
  // correct reading (no owners yet; my own profile).
  {
    from: 16,
    to: 17,
    migrate: (data) => {
      const settings =
        typeof data.settings === 'object' && data.settings !== null
          ? (data.settings as Record<string, unknown>)
          : {};
      return {
        ...data,
        settings: {
          ...settings,
          defaultPlayerGroup:
            settings.defaultPlayerGroup ?? DEFAULT_ROOM_SETTINGS.defaultPlayerGroup,
        },
      };
    },
  },
  // v17 -> v18: presence & seat lifecycle (R26). `PlayerSeat` gains
  // `lastPresentAt`, the durable half of the ephemeral presence channel.
  //
  // A NO-OP on the room doc, deliberately, and worth stating why rather than
  // leaving a reader to wonder:
  //
  //  - The field lives on a *subcollection* doc (`players/{uid}`), and
  //    `migrateRoom` only ever sees the room doc. It could not backfill seats
  //    even if we wanted it to — the v11->v12 / v14->v15 / v16->v17 precedent
  //    for additive subcollection fields is exactly this.
  //  - We do not want it to. R26.2 asks that pre-existing seats not read as
  //    abandoned, and ABSENCE already achieves that: `abandonedSeatUids`
  //    requires a `lastPresentAt` older than the cutoff, so a seat with none is
  //    never offered for pruning. It earns a value the first time its player
  //    connects, which is an observation rather than a guess.
  //
  // The version bump still earns its keep: it stamps `.vttcamp` archives, so an
  // archive carrying seats with `lastPresentAt` is distinguishable from one
  // that predates the field.
  {
    from: 17,
    to: 18,
    migrate: (data) => ({ ...data }),
  },
  // v18 -> v19: room lifecycle (R25.1). The room doc gains `lastActivityAt`,
  // the clock every dormancy decision reads.
  //
  // Seeded to the **migration timestamp**, deliberately, not to zero or to
  // `createdAt`: a zero seed would make every live campaign in existence read
  // as 90 days dormant the instant this shipped, and offer the referee a Delete
  // button for a room they played in last night. "We started counting now" is
  // the only honest reading of a room we have no history for.
  //
  // Note this runs at *read* time too (`roomConverter.fromFirestore` walks
  // every doc through `migrateRoom`), so a pre-v19 room reads as freshly active
  // until its first settled write persists a real value. That is the same
  // conservative direction: a room can only look dormant once we have actually
  // observed it going quiet.
  {
    from: 18,
    to: 19,
    migrate: (data) => ({
      ...data,
      lastActivityAt: data['lastActivityAt'] ?? Date.now(),
    }),
  },
  // v19 -> v20 (SPEC-031, IN-025/DEC-033): `ProfileInstance.color` stops being
  // an optional *choice* and becomes a value every character always has. An
  // absent `color` no longer means "deliberately no custom colour" (which used
  // to make that seat's dice render the theme-wide `--dice-face` neutral); it
  // now means only "written before this rule, needs backfill".
  //
  // A NO-OP on the room doc, for the v17->v18 reason and one more:
  //
  //  - The field lives on a *subcollection* doc (`profiles/{seatId}`), and
  //    `migrateRoom` only ever sees the room doc — the v11->v12 / v14->v15 /
  //    v17->v18 precedent for subcollection fields is exactly this.
  //  - Rewriting documents would not be enough even if it could. A seat may
  //    have **no profile document at all** (one is created lazily by the first
  //    sheet/portrait/colour write), and you cannot backfill a field onto a
  //    document that does not exist. So the backfill is a *resolution* rule
  //    instead: `assignedCharacterColor(seatId)` derives the colour
  //    deterministically wherever one is read (`resolveCharacterColor`), and
  //    `migrateProfile` below applies the same derivation at the one boundary
  //    where documents really are rewritten — `.vttcamp` import.
  //
  // The version bump still earns its keep: it stamps `.vttcamp` archives, so an
  // archive whose profiles are guaranteed coloured is distinguishable from one
  // that predates the rule.
  {
    from: 19,
    to: 20,
    migrate: (data) => ({ ...data }),
  },
];

/**
 * The v19->v20 half that the room-doc walk cannot do (SPEC-031 §2): takes one
 * raw `profiles/{seatId}` document and guarantees it carries a `color`,
 * derived deterministically from the seat id when it does not.
 *
 * `seatId` is passed separately because a profile document's seat id is its
 * *document id*, which never appears in the stored fields (see
 * `profileInstanceConverter`) — in a `.vttcamp` archive it rides as `id`.
 *
 * Idempotent: a document that already carries a colour is returned unchanged,
 * so re-importing an archive never repaints anybody.
 */
export function migrateProfile(
  data: Record<string, unknown>,
  seatId: string,
): Record<string, unknown> {
  if (typeof data['color'] === 'string') return data;
  return { ...data, color: assignedCharacterColor(seatId) };
}

export class MigrationError extends Error {
  constructor(fromVersion: number) {
    super(`No migration registered starting from schemaVersion ${fromVersion}`);
    this.name = 'MigrationError';
  }
}

/** Migrate a raw room-doc-shaped object forward to CURRENT_SCHEMA_VERSION. */
export function migrateRoom(
  input: Record<string, unknown>,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  let data = input;
  let version = Number(data['schemaVersion'] ?? 0);

  while (version < targetVersion) {
    const step = migrations.find((m) => m.from === version);
    if (!step) {
      throw new MigrationError(version);
    }
    data = { ...step.migrate(data), schemaVersion: step.to };
    version = step.to;
  }

  return data;
}
