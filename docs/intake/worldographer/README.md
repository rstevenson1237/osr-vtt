# Supplied Worldographer icon sets — intake material for IN-114

Two zips supplied by the project owner on 2026-09-08, parked here on the IN-089 precedent
(`docs/intake/hex-symbols/`) so the execution session has them: they arrived as session
uploads and would otherwise not survive. **Nothing here is in `apps/web/public/` yet, and
nothing goes there before `ATTRIBUTION.md` carries the entry** (SPEC-047 §6's rule, restated
in §8).

| File | Contents |
| ---- | -------- |
| `bw-icons.zip` | 37 PNG, 300×300 RGBA, plus `black_white.properties` and a `.wxx` config |
| `multicolored-classic.zip` | 60 PNG, 250×250 (one 300×300), plus a `.wxx` config |

## Provenance — what is actually known

The sets are the free downloads from Worldographer's extra-icon-sets page, attributed to
**Inkwell Ideas, Inc.**, released to the public domain; a credit is appreciated but not
required.

**This rests on the project owner's confirmation in session, plus a web-search summary.**
`worldographer.com` and `hexographer.com` were both blocked by the planning session's egress
proxy, so the licence statement **could not be fetched verbatim**. `ATTRIBUTION.md` must
record it in those terms and no stronger — not as a quotation. Re-fetching it from an
unblocked network would settle this cheaply and is worth doing before the entry is written.

## Measured properties (2026-09-08, verified against the files)

**`bw-icons`** — every one of the 37 is a **single flat ink colour `#484848`** with the
antialiasing carried entirely in the alpha channel. True single-tone silhouettes: white
re-authoring is an RGB substitution preserving alpha, not a redraw (DEC-083 (ii)).
`black_white.properties` names 25 of the 37 with label, category (Forests / Rough Land /
Other Land / Water) and a 0.82 scale factor. The other 12 are unreferenced extras:
`forest-mixed{,-heavy,-hills,-mountain,-mountains}`, `forested-mountain`,
`evergreen-mountain`, `jungle-{heavy,mountain,mountains}`, `mountain{,s}-snow`, `badlands`,
`volcano-dormant`. **There is no water or ocean glyph** — Worldographer draws Ocean and Sea
as a background colour with no icon.

**`multicolored-classic`** — **55 of the 60 are multi-tone** (2–5 ink colours) and cannot be
flattened by substitution; a multiply tint expresses one tone. **Six are single-tone** and are
the only ones this pack may draw on: `cultivatedfarmland`, `deadforest`, `grassyhills`,
`reefs`, `sandydesert`, `snowfields`.

## Tracing

The execution session traces the alpha mask to a single
`<path class="ink" fill="#ffffff" fill-rule="evenodd">` per icon. Proven with `potracer`
(pure Python, no system dependency) at threshold 128: 2–17 subpaths and 16–148 segments per
icon, 0.6–5.0 KB, mostly **smaller** than the source PNG. The threshold is the judgement call
and belongs in the completion summary, along with a look at the densest glyphs
(`forest-heavy`, `forest-mixed-mountains`), which are where fidelity fails first if it fails.

See `INTAKE.md` → IN-114, `DECISIONS.md` → DEC-088, and SPEC-047 §8.
