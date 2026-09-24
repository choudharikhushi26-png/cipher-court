# Architecture (stub — full write-up in Phase 10)

The full design is the v3 Build Blueprint (case schema, edge model, validation
pipeline, interrogation pipeline, scoring formula, failure handling). This
file will absorb that content plus real diagrams once the build is complete
and stable, per the Phase 10 plan.

## Current implementation status vs. blueprint

| Blueprint piece | Status |
|---|---|
| Single Evidence→Suspect edge shape | ✅ implemented (`data/hardcodedCase.js`) |
| Backend-authoritative case store, no DB | ✅ implemented (`lib/caseStore.js`, in-memory `Map`, TTL sweep) |
| `PLAYER_VIEW` strips all private fields | ✅ implemented (`lib/gameView.js`) — verified by smoke test that no response contains `is_culprit`, `is_red_herring`, `secret`, or `trigger_keywords` |
| Deterministic fact retrieval (trigger keywords) | ✅ implemented (`lib/factRetriever.js`) |
| LLM rendering over retrieved facts | ⬜ Phase 6 — currently a deterministic template renderer (`lib/deterministicRenderer.js`) stands in for the LLM, so the whole game already works without one |
| Scoring formula | ✅ implemented (`lib/reasoningScorer.js`) — unit-tested against perfect reasoning, wrong-culprit-partial-credit, duplicate claims, and contradictory claims |
| Validation pipeline (schema/graph/solution/heuristic uniqueness/discoverability) | ⬜ Phase 5 — not needed yet since the case is hardcoded, not generated |
| Real frontend screens | ⬜ Phase 3 — current frontend is a one-page connectivity check |
