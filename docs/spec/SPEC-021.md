## SPEC-021 — Advantage/disadvantage by mode

**Status: Completed**

Shipped; see `README.md` § "Dice (II.6)". Seed-authoritative determinism is preserved:
the RNG stream is consumed in a documented, stable order for the pool case so
re-derivation matches across clients.
