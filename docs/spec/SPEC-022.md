## SPEC-022 — Token status ring

**Status: Completed**

Shipped; see `README.md` § "Tokens, assets & theming (II.7)".

> **Superseded in part (SPEC-023).** "Owned by the viewing player" still means
> `token.ownerSeatId === myUid` — the ring is unchanged — but `ownerSeatId` no longer
> means authority. The ring marks "my own character's token", not "a token I may move".
> **§3 (optional split):** because _selected_ and _owned_ both map to white, a player
> selecting their own token sees no change. The cheapest split, if ever wanted, is
> owned = solid white ring, selected = solid white **+ a subtle glow/thicker stroke**.
> Not built.
