# Cipher Court — EVOX 1.0 Build Blueprint (v3 — Implementation-Ready)

*This revision is the engineering source of truth. It supersedes v2's schema and architecture where they conflict. No code yet — this is the last design pass before implementation.*

---

## 1. Critical Issues Found

Real problems in v2, not stylistic notes:

- **Solution-leakage risk (the most serious issue).** v2 never specified *where* the full case JSON lives. If the backend ever sends the complete case — including `solution`, `is_culprit`, and `is_red_herring` flags — to the frontend in one payload (even for "the validator runs client-side" convenience), the answer sits in browser memory/devtools from turn one. A player who opens devtools solves the case instantly. This is fixed in this revision by making the backend the sole holder of ground truth (§3–4).
- **Schema ambiguity.** v2's `Evidence → Motive(node) → Suspect` chain was never resolved to a single edge shape — it's unclear whether `ESTABLISHES_MOTIVE` connects Evidence to a Motive node or Evidence to a Suspect. This makes the validator, scorer, and UI each free to interpret it differently, which is a guaranteed source of bugs. Resolved in §2.
- **Scoring was illustrative, not exact.** v2 showed a ✓/✗ example but never defined a formula, what counts as "partial credit," or how duplicate/contradictory claims are handled. Resolved in §7.
- **Interrogation matching was hand-wavy.** "Match on time references, names, locations" was never reduced to an actual deterministic algorithm — as described, it's not testable and would likely be built ad hoc under time pressure, which is exactly how hallucination risk creeps back in. Resolved in §6 with a concrete, generation-time-authored keyword scheme.
- **Heuristic uniqueness check had a gap.** v2's check ("no other suspect has motive + opportunity + no contradicting alibi") doesn't account for a suspect who has motive and opportunity but whose *evidence* for those is weaker/less discoverable than the culprit's — the check as written can still pass a case with a genuinely confusing second valid-looking suspect. Tightened in §5.
- **Frontend scope is the largest schedule risk in the project**, full stop. Ten screens, an evidence board, a reasoning builder, and live interrogation is a lot of UI surface for 5 weeks — v2 already flagged the graph canvas as a cut; this revision cuts further (§8).
- **No defined behavior for browser refresh or localStorage corruption** — both are realistic during a live judged demo (a judge's device, a flaky wifi reload). Resolved in §12.
- **No retry/backoff bound was ever specified** for repeated generation failures — "retry once, then fallback" was stated but not wired into a concrete state machine. Resolved in §5.

---

## 2. Final Design Decisions

**One clean edge shape, resolving the Evidence→Motive→Suspect ambiguity:**

> Every edge, in the ground truth and in player claims, is exactly **Evidence → Suspect**, typed by `claim_type`, carrying optional metadata. There are no Motive or Method nodes as edge endpoints. Motive and method are **text fields owned by the case's `solution` object**, and an edge of type `ESTABLISHES_MOTIVE` or `ESTABLISHES_METHOD` simply means "this evidence is what justifies that solution field for this suspect." Location and time are edge **metadata** (`location_id`, `event_id`), not additional hops.

This is the single decision that removes the most ambiguity in the whole system: validator, scorer, UI, and player-claim structure all use the identical `{evidence_id, suspect_id, claim_type, metadata}` shape, everywhere, with no exceptions. It's also the easiest version to explain to a judge in one sentence: *"every clue points directly at a person."*

**Backend is the sole authority on ground truth.** The frontend never receives `solution`, `is_culprit`, `is_red_herring`, or the private edge list until the verdict/reveal step. This is a hard architectural rule, not a preference (§1).

**Interrogation keyword matching is authored at generation time, not inferred at runtime.** Each `knowledge` fact the LLM generates must also include a short `trigger_keywords` array as part of the schema (§3). Retrieval at play time is then pure deterministic set-overlap against those pre-authored keywords — no runtime NLP, no ambiguity, fully testable offline before the demo.

---

## 3. Canonical JSON Schema

Four distinct objects, deliberately separated so the "what does the frontend ever see" question has one obvious answer per object.

### CASE_WORLD (backend-only, full, never sent whole)
```json
{
  "caseId": "string",
  "victim": "string",
  "setting": "string",
  "locations": [{"id": "string", "name": "string", "description": "string"}],
  "events": [{"id": "string", "time": "string", "description": "string", "location_id": "string"}],
  "suspects": [
    {
      "id": "string", "name": "string", "relationship_to_victim": "string",
      "alibi_claim": "string",
      "is_culprit": "boolean  // PRIVATE",
      "secret": "string | null  // PRIVATE",
      "knowledge": [
        {"fact_id": "string", "fact": "string", "trigger_keywords": ["string"]}
      ]
    }
  ],
  "evidence": [
    {
      "id": "string", "description": "string", "location_id": "string",
      "discoverable_at": "investigation | interrogation",
      "is_red_herring": "boolean  // PRIVATE"
    }
  ],
  "solution": {
    "culprit_id": "string", "motive_text": "string", "method_text": "string"
  },
  "edges": [
    {
      "evidence_id": "string", "suspect_id": "string",
      "claim_type": "PLACES_AT | CONTRADICTS | ESTABLISHES_MOTIVE | ESTABLISHES_METHOD | SUPPORTS_ALIBI",
      "metadata": {"location_id": "string | null", "event_id": "string | null", "note": "string | null"},
      "is_required": "boolean"
    }
  ]
}
```

### PLAYER_VIEW (what the frontend actually holds — derived, cumulative, stripped)
```json
{
  "caseId": "string",
  "victim": "string",
  "setting": "string",
  "discoveredLocations": ["Location (public fields only)"],
  "discoveredEvents": ["Event (public fields only)"],
  "knownSuspects": ["{id, name, relationship_to_victim, alibi_claim}  // no is_culprit, no secret"],
  "discoveredEvidence": ["{id, description, location_id}  // no is_red_herring"],
  "questionBudget": "number"
}
```
This is built server-side per response and is the *only* thing that ever crosses the wire pre-verdict. `is_culprit`, `is_red_herring`, `solution`, and `edges` never appear in any response until `submit-reasoning` returns.

### PLAYER_REASONING (submitted by client at accusation time)
```json
{
  "accused_suspect_id": "string",
  "claims": [
    {"evidence_id": "string", "claim_type": "string", "target_suspect_id": "string", "metadata": {"note": "string | null"}}
  ],
  "stated_motive": "string",
  "stated_method": "string"
}
```

### VERDICT_RESULT (returned once, after scoring — this is when the truth is finally released)
```json
{
  "correct_culprit": "boolean",
  "claims_scored": [{"claim": "PLAYER_REASONING.claims[i]", "result": "correct | partial | incorrect"}],
  "motive_correct": "boolean", "method_correct": "boolean",
  "score": "number (0-100)",
  "revealedCase": "full CASE_WORLD, now safe to expose"
}
```

---

## 4. Game State Model

| Data | Lives in | Why |
|---|---|---|
| `caseId` | React state + localStorage | needed to resume, safe to expose |
| `discoveredEvidence`, `discoveredEvents`, `knownSuspects` | React state, mirrored to localStorage | already shown to the player, safe to persist |
| `playerClaims` (draft reasoning) | React state, mirrored to localStorage | player's own claims, safe — contains no ground truth |
| `confirmedClaims` (mid-game internal-consistency checks, §7 of v2) | React state only | ephemeral UI feedback, no need to persist |
| `interrogationHistory` | React state, mirrored to localStorage | transcript, safe to persist (contains no unrevealed facts beyond what was already shown) |
| `questionBudget` | React state, mirrored to localStorage | simple counter |
| `finalReasoning`, `score`, `revealedCase` | React state only, **not persisted** | only exists post-verdict; no need to survive a refresh, and persisting a revealed case is harmless but unnecessary |
| **Full `CASE_WORLD` with `solution`/`edges`** | **Backend in-memory map, keyed by `caseId`, TTL-expired** | never touches the client until reveal — this is the architectural fix from §1 |

No database for MVP: an in-memory `Map<caseId, CaseWorld>` on the backend process is sufficient for a hackathon-scale demo; it resets on server restart, which is acceptable (regenerate a case rather than persist across deploys).

---

## 5. Validation Pipeline

```
generateCase(params)
   ↓
parseJSON(rawLLMOutput)                      // GUARANTEED: fails closed on malformed JSON
   ↓
schemaValidation(case)                       // GUARANTEED: every field present, every ID referenced exists
   ↓
graphValidation(case)                        // GUARANTEED (see checks below)
   ↓
solutionValidation(case)                     // GUARANTEED (see checks below)
   ↓
heuristicUniquenessCheck(case)               // HEURISTIC — labeled, see below
   ↓
discoverabilityCheck(case)                   // HEURISTIC (reachability proxy, see below)
   ↓
PASS → cache in backend store, return caseId
FAIL → retryCount++; if retryCount < 2: regenerate; else: load fallbackCases[random], mark as "fallback-served"
```

**GUARANTEED checks (cheap, deterministic, always enforced):**
- JSON parses; every field in the schema present; every `evidence_id`/`suspect_id`/`location_id`/`event_id` referenced in `edges` exists in the corresponding array
- Exactly one suspect has `is_culprit: true`
- The culprit has at least one edge of each: `ESTABLISHES_MOTIVE`, `ESTABLISHES_METHOD`, `PLACES_AT`
- No two `is_required: true` edges are mutually `CONTRADICTS` (the solution can't contradict itself)
- Every suspect has an `alibi_claim` and at least one edge of type `SUPPORTS_ALIBI` or `CONTRADICTS` referencing them

**HEURISTIC checks (proxy, explicitly not a proof — documented as such in the README and in judge-facing materials):**
- `heuristicUniquenessCheck`: for every non-culprit suspect, check whether they have an `ESTABLISHES_MOTIVE`-type edge **and** a `PLACES_AT`-type edge **and** no `CONTRADICTS` edge against their alibi, **and** whether the evidence backing those edges is actually reachable (see discoverability below — tightened from v2, which missed this). If any suspect satisfies all of that, fail and regenerate. This narrows, but does not eliminate, the chance of an ambiguous second solution — stated plainly, not oversold.
- `discoverabilityCheck`: every `is_required: true` edge's `evidence_id` must have `discoverable_at` reachable through normal play (investigation or interrogation) with no dependency on evidence that is itself unreachable. This is a reachability check, not a full playthrough simulation, and is labeled as such.

---

## 6. Interrogation Pipeline

```
Player question (free text)
   ↓
normalize(question)                    // lowercase, strip punctuation
   ↓
tokenize(question) → tokenSet
   ↓
for each fact in suspect.knowledge:
     overlap = |tokenSet ∩ fact.trigger_keywords|
   ↓
rank facts by overlap, descending
   ↓
if topOverlap == 0:
     → DEFLECT: canned in-character line, no LLM call needed
     (e.g. template: "{suspect.name} shrugs. 'I couldn't tell you anything about that.'")
else:
     allowedFacts = top 1–2 facts with overlap > 0
     ↓
     LLM renders allowedFacts as in-character natural-language reply
     ↓
     postCheck: does reply reference any fact_id, suspect name, evidence description,
                or time NOT present in allowedFacts + already-public case info?
     ↓
     pass → display
     fail → regenerate once with stricter instruction
            → still fails → DETERMINISTIC FALLBACK: template-wrap the raw allowedFacts
              text in quotes with a persona wrapper, no LLM involved
              (guarantees zero hallucination ever reaches the player, worst case
              the line reads stiffly rather than wrong)
```

**Time references:** a simple regex (`\d{1,2}(:\d{2})?\s?(am|pm)?`, plus a small dictionary of relative terms — "morning," "evening," "around nine") matched against `event.time` strings authored at generation. **Entity detection:** substring match against a per-case dictionary of proper nouns (suspect names, location names, short evidence titles) compiled once at generation time — not NLP, just string containment, which is fast and fully deterministic.

**Why no LLM intent-classification step:** the brief asked to prove it's necessary before adding it. It isn't, for MVP — trigger-keyword overlap plus the entity/time dictionary covers the realistic question space a player will type ("where were you," "what about the letter," "do you know Marcus"), and adding a classification LLM call would be a third AI touchpoint and a third failure surface for no demonstrated gain. Keep it as a stretch item only if testing reveals real matching gaps (§8).

---

## 7. Reasoning & Scoring System

**Player claim structure** (already defined in §3): `{evidence_id, claim_type, target_suspect_id, metadata}`.

**Definitions:**
- **Correct edge** — claim exactly matches a ground-truth edge (`evidence_id` + `claim_type` + `suspect_id` all match).
- **Partial** — `evidence_id` + `suspect_id` match a ground-truth edge but `claim_type` doesn't (e.g. player said `ESTABLISHES_MOTIVE`, ground truth for that pair is `PLACES_AT`).
- **Incorrect** — no ground-truth edge exists for that `evidence_id` + `suspect_id` combination at all (includes red-herring evidence wrongly connected).
- **Duplicate claim** — identical `{evidence_id, claim_type, target_suspect_id}` submitted twice; scored once, second instance ignored.
- **Contradictory claims** — player submits both `SUPPORTS_ALIBI` and `CONTRADICTS` for the same `evidence_id` + `suspect_id` pair; both are marked incorrect regardless of ground truth (internally inconsistent claims can't both be rewarded).

**Scoring formula** (deliberately simple — explainable in 20 seconds on stage):
```
score = 50 × (culprit correct ? 1 : 0)
      + 10 × (motive_text correct ? 1 : 0)
      + 10 × (method_text correct ? 1 : 0)
      + 30 × (required edges correctly claimed / total required edges)
      − 5  × min(incorrect claim count, 4)     // capped penalty, floor at 0
```
Demo framing: *"Half your score is naming the right person. Thirty percent is the quality of your evidence chain. The rest is motive and method — and guessing wrong costs you a little."*

- **Correct culprit, weak reasoning** — full 50 points, low fraction of the 30, still a passing-but-thin score. Surfaces visually as "right answer, unconvincing case."
- **Wrong culprit, some correct evidence** — 0 from the culprit term, but the required-edges fraction is still scored on its own terms (edges are evaluated against the true ground truth regardless of who the player accused), so partial credit is preserved and visible.

---

## 8. Final MVP Scope

**MUST BUILD:**
- Backend: `/generate-case`, `/ask-suspect`, `/submit-reasoning` endpoints; in-memory `CaseWorld` store; full validation pipeline (§5); fact-retrieval interrogation pipeline (§6); scoring (§7)
- Frontend: Landing → Generation → Briefing → Investigation → Evidence Board (structured claim-picker, **not** a free-drag graph canvas) → Interrogation → Reasoning Builder → Accusation → Verdict → Reveal
- localStorage resume for the safe subset of state (§4)
- 3 bundled fallback cases for generation failure
- Deflection template + deterministic fallback template for interrogation failure

**ONLY IF EVERYTHING ELSE WORKS (in priority order):**
1. Visual polish pass (animations, noir styling beyond functional CSS)
2. Free-drag graph canvas upgrade over the structured picker
3. Mid-game internal-consistency hints (§7 of v2 — "these two things you believe can't both be true")
4. LLM-based intent classification (only with a demonstrated matching gap from testing)
5. Difficulty parameter exposed in UI
6. Session/rank persistence across games

Nothing from the second list enters the first silently — if week 4 arrives and MVP items remain, stretch work stops, full stop.

---

## 9. Frontend Architecture (Screens)

| Screen | Purpose | Key UI | Player action | Data in | Data out |
|---|---|---|---|---|---|
| Landing | Set tone, entry point | Title, "New Case" button, noir styling | Click New Case | none | generation request |
| Case Generation | Show AI authoring the world | Sequential status lines ("Placing suspects," "Checking consistency") | Wait / watch | generation progress events | — |
| Briefing | Establish victim, setting, stakes | Case-file layout: victim, setting, starting evidence | Read, proceed | PLAYER_VIEW (initial) | — |
| Investigation | Explore locations, surface evidence | Location list/map, "Search" action per location | Click to search a location | PLAYER_VIEW | discovered evidence added to state |
| Evidence Board | The core puzzle-solving screen | Evidence cards, claim-type picker, suspect targets | Connect evidence to a suspect via a claim type | discoveredEvidence, knownSuspects | playerClaims |
| Interrogation | Fill specific gaps via dialogue | Suspect cards, question input, remaining-question counter | Type a question | PLAYER_VIEW, questionBudget | interrogationHistory, possibly new evidence |
| Reasoning Builder | Assemble the final accusation | Ordered list of claimed evidence→suspect connections, culprit selector, motive/method text fields | Arrange/edit claims, pick culprit | playerClaims | PLAYER_REASONING |
| Accusation | Final confirm before submit | Summary of the reasoning chain | Confirm submit | PLAYER_REASONING | POST to `/submit-reasoning` |
| Verdict | Per-line correctness | ✓/✗ list matching §7, score total | Read | VERDICT_RESULT | — |
| Ground Truth Reveal | Full case exposed | Complete graph/list of every true edge, overlaid against player's claims | Read, replay | VERDICT_RESULT.revealedCase | — |

Visual direction stays as v2 specified: case-file/corkboard noir aesthetic, not a SaaS dashboard — serif display type, dark palette, physical-object metaphors (folders, pinned cards, string connections) rather than generic cards-and-charts UI.

---

## 10. Backend Architecture

- **`POST /api/case/generate`** — runs §5 pipeline, stores full `CaseWorld` in-memory keyed by `caseId`, returns initial `PLAYER_VIEW`.
- **`POST /api/case/:caseId/investigate`** — given a `location_id`, returns any evidence/event newly discoverable there (server checks `CaseWorld`, returns only public fields).
- **`POST /api/case/:caseId/ask-suspect`** — runs §6 pipeline server-side (keeps `knowledge`/`trigger_keywords` off the client entirely), returns the rendered reply plus any evidence it surfaces.
- **`POST /api/case/:caseId/submit-reasoning`** — runs §7 scoring against the stored `CaseWorld`, returns `VERDICT_RESULT` including the now-safe-to-reveal full case.
- In-memory store: `Map<caseId, {caseWorld, createdAt}>`, swept on a timer (e.g. evict after 2 hours) — no database needed.
- Backend never trusts client-submitted claims blindly; scoring always re-derives against the server's own stored ground truth, never against anything the client sends back about the case itself.

---

## 11. Folder Structure

```
cipher-court/
  frontend/
    src/
      screens/        (Landing, Generation, Briefing, Investigation, EvidenceBoard,
                        Interrogation, ReasoningBuilder, Accusation, Verdict, Reveal)
      components/      (EvidenceCard, SuspectCard, ClaimPicker, ScoreBreakdown)
      state/           (gameStateStore.js, persistence.js — localStorage read/write for the safe subset)
      lib/
        apiClient.js    (thin fetch wrapper to backend endpoints)
      App.jsx
    index.html
  backend/
    server.js
    routes/
      generate.js
      investigate.js
      askSuspect.js
      submitReasoning.js
    lib/
      promptBuilder.js
      factRetriever.js       (§6)
      graphValidator.js      (§5)
      reasoningScorer.js     (§7)
      caseStore.js           (in-memory Map + TTL sweep)
      fallbackCases.json
  prompts/
    system_generation.md
    system_interrogation.md
    CHANGELOG.md
  README.md
  ARCHITECTURE.md
```

Key change from v2: `graphValidator.js`, `factRetriever.js`, and `reasoningScorer.js` all now live **backend-side only** — none of the logic that touches ground truth exists in the frontend bundle at all, which is the concrete fix for §1's leakage risk.

---

## 12. Failure & Fallback Strategy

| Failure | Fallback |
|---|---|
| LLM returns malformed JSON | `parseJSON` catches, triggers retry (§5) |
| Generated case fails validation | Regenerate once; second failure → serve a bundled fallback case |
| Second generation also fails | Serve fallback case, tag session as `fallback-served` (internal only, invisible to player) |
| API timeout | 8s client timeout → same retry/fallback path as above |
| API unavailable entirely | Skip straight to fallback case; interrogation falls back to the deterministic template path (§6) for the whole session |
| Suspect question has no matching fact | Deterministic deflection template, no LLM call needed |
| LLM adds an unauthorized fact | Caught by post-check (§6), regenerate once, then deterministic template fallback |
| Browser refresh | Rehydrate from localStorage's safe subset (§4) + re-fetch current `PLAYER_VIEW` from backend via `caseId`; ground truth was never in the browser to lose |
| localStorage corruption | On parse failure, discard and start a fresh case rather than crash |

The through-line: **every single failure mode degrades to "still playable," never to "broken demo."**

---

## 13. Judge-Facing AI Explanation

- **Why AI?** Hand-authoring a fresh, internally consistent mystery — suspects, evidence, timeline, one guaranteed culprit, non-contradictory red herrings, all in natural language — is a real constraint-satisfaction-plus-content-generation problem. An LLM does both at once; a rules-only generator would need a bespoke solver rebuilt per setting.
- **Why not a normal procedural mystery game?** Procedural generation without an LLM is possible for the *structure*, but produces templated, mechanical content, not natural, varied prose — and adapting it to new settings/themes means re-engineering the generator each time rather than just changing a prompt.
- **What exactly does the LLM generate?** The entire case graph once at the start (suspects, evidence, timeline, motive, method, red herrings, the edges between them) — and, per question, a natural-language rendering of a small, pre-approved fact set during interrogation.
- **What does deterministic code control?** Everything else: validation, discoverability, evidence-board interactions, scoring, all game-state transitions, and — critically — fact retrieval for interrogation (the LLM never chooses *what* a suspect knows, only how they phrase it).
- **How do we prevent hallucinated evidence?** Two layers: the LLM is only ever given a pre-filtered fact set to render (§6), and every rendered reply is checked afterward for facts outside that set before it's shown to the player.
- **How does the player actually use AI?** They're solving a puzzle the AI authored — reconstructing its causal structure — not chatting with it. The AI's output *is* the level.
- **What makes this more than an AI chatbot?** The chatbot-only version would be: player types, AI answers, points awarded. Here, the AI's generation *is* the game state (the puzzle itself), and gameplay is entirely deterministic graph interaction on top of it.

---

## 14. 5-Minute Demo Script

- **0:00–0:40 — Generate.** Click New Case live; narrate the visible generation steps as node previews appear.
- **0:40–1:20 — Structure appears.** Point at the briefing/evidence-board screen: "this whole world was just authored."
- **1:20–2:20 — Investigate.** Search a location live, surface a piece of evidence on camera.
- **2:20–3:00 — Build reasoning.** Connect that evidence to a suspect via the claim picker.
- **3:00–3:40 — Interrogate.** Ask a live, improvised question; show the fact-constrained, in-character reply.
- **3:40–4:10 — Submit.** Complete and submit a short reasoning chain (accuse, state motive/method).
- **4:10–4:40 — Verdict.** Show the ✓/✗ per-line breakdown and score.
- **4:40–5:00 — Reveal + close.** Show the full ground-truth graph overlay, deliver the closing line: "this puzzle didn't exist ten minutes ago, and it can never repeat."

Deliberately no time is spent walking through code or architecture live — §13's story is told verbally, briefly, if a judge asks, not scheduled into the core five minutes.

---

## 15. 5-Week Development Plan

- **Week 1** — Backend skeleton + hardcoded case: `caseStore`, `generate` endpoint returning a hardcoded `CaseWorld`, `investigate`/`ask-suspect` endpoints serving static content. Frontend: Landing → Briefing → Investigation → Evidence Board with the claim picker, working end-to-end on the hardcoded case, no LLM calls anywhere yet.
- **Week 2** — Reasoning Builder, Accusation, Verdict, Reveal screens wired to `submitReasoning` (§7 scoring) against the hardcoded case. Full loop playable, zero AI.
- **Week 3** — Wire real LLM calls: `promptBuilder`, `graphValidator` (§5) replacing the hardcoded case with generated ones; bundle 3 fallback cases.
- **Week 4** — Wire `factRetriever` (§6) for real interrogation; build the deflection/deterministic-fallback templates; test matching against a real question set.
- **Week 5** — Failure-mode testing (§12) against the actual demo device/network, visual polish pass, README/ARCHITECTURE/prompt changelog, deploy, rehearse the demo script (§14) at least twice end-to-end.

---

## 16. Final Build / Don't Build Checklist

**Build:** backend-authoritative case store; single Evidence→Suspect edge shape; keyword-authored fact retrieval; structured claim-picker evidence board; exact scoring formula; 3 bundled fallback cases; deterministic interrogation fallback template; localStorage resume for the safe state subset only.

**Don't build (for this hackathon):** free-drag graph canvas; LLM intent classification; exhaustive/NP-style uniqueness proof; a database; multiplayer; persistent player accounts/rank; any transmission of `solution`/`edges`/`is_culprit`/`is_red_herring` to the frontend before verdict, under any circumstance.

---

## BUILD READINESS

**READY TO BUILD.**

The design has no unresolved architectural ambiguity left — the edge-shape decision (§2), the backend/frontend data split (§3–4), and the exact scoring formula (§7) were the three genuinely open questions from v2, and all three are now closed. The one standing condition: confirm actual available team hours before Week 1 starts — if this ends up solo rather than a full team, cut interrogation depth first (fewer facts per suspect, shorter `trigger_keywords` sets) before cutting anything from the core evidence-graph loop, since the reasoning system is the concept's actual differentiator and the graph-vs-chatbot distinction is what the whole submission stands or falls on.
