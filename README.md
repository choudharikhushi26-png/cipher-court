# Cipher Court

*Status: Phase 1 + Phase 2 complete — deterministic, zero-LLM game loop. Full
problem statement, architecture, and design rationale will be documented here
in Phase 10; this is a working-setup README for now.*

## Running locally

**Backend**
```
cd backend
npm install
npm run dev
```
Starts on `http://localhost:4000`. Health check: `GET /api/health`.

**Frontend**
```
cd frontend
npm install
npm run dev
```
Starts on `http://localhost:5173` and proxies `/api/*` to the backend
(see `vite.config.js`) — no CORS setup needed in dev.

## What works right now (Phase 2)

The entire game loop is playable via the API with **zero LLM dependency**,
against one hand-authored case (`backend/data/hardcodedCase.js`):

- `POST /api/case/generate` — starts a session, returns the initial player view
- `POST /api/case/:caseId/investigate` — `{ locationId }` → discovers evidence/events there
- `POST /api/case/:caseId/ask-suspect` — `{ suspectId, question }` → deterministic,
  keyword-matched, template-rendered reply (no AI involved yet — this is the
  same fact-retrieval logic the LLM will sit on top of in Phase 6)
- `POST /api/case/:caseId/submit-reasoning` — scores the player's reasoning chain
  and reveals the full case

Try it with curl once the backend is running:
```
curl -s -X POST http://localhost:4000/api/case/generate | jq
```

## Not built yet

Real frontend screens (Phase 3), LLM case generation (Phase 5), LLM-backed
interrogation (Phase 6), persistence/failure-mode hardening (Phase 7), and
visual polish (Phase 9). See `ARCHITECTURE.md` for the full blueprint.
