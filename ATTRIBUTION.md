# ATTRIBUTION

Provenance and licence terms for every third-party asset or reference this project ships
or consulted. Required by SPEC-003 §5 (a standing constraint): no asset is added to the
repository without an entry here.

## Dice

**No third-party assets.** Every dice asset — geometry, number textures, materials — is
generated procedurally at runtime. No GLB mesh, texture, material or audio file is shipped.

`owlbear-rodeo/dice` (GPL-3.0) was examined as a reference **during planning only**. Its
techniques were restated in our own terms in SPEC-003; none of its code or assets was
copied, traced or placed in this repository.

## Hex terrain art — `apps/web/public/assets/hex/terrain/`

- **Source:** the `bw-icons` and `multicolored-classic` icon sets by **Inkwell Ideas, Inc.**
  (Worldographer), supplied by the project owner.
- **Terms:** public domain, as stated by the project owner and recorded in DEC-088
  (answered 2026-09-08).
- **Modification:** traced from PNG to single-path SVG and re-inked white so the render
  pipeline can tint it (DEC-083, DEC-088). Kind names come from the source filenames.

## Hex contents art — `apps/web/public/assets/hex/contents/`

Authorship and licence of this pack are **not established in the repository**: DEC-083 records
that it shipped with no licence or authorship metadata, and DEC-088 puts contents out of
scope. This entry is a placeholder, not a clearance — the owner should record the source and
terms here.

## Adding an entry

Add a section for any third-party asset in the same change that adds the asset. Each entry
states:

- **Asset** — path or glob under the repository.
- **Source** — author or publisher, and where it was obtained.
- **Terms** — licence name and version (or "public domain" with the basis for saying so).
- **Modification** — what was changed, or "none".
- **Decision** — the `DEC-nnn` or `WI-nnn` that approved it.
