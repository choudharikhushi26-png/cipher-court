import { Router } from "express";
import { makeHardcodedCase } from "../data/hardcodedCase.js";
import { createSession, getSession } from "../lib/caseStore.js";
import { buildPlayerView } from "../lib/gameView.js";

const router = Router();

// Phase 2: always serves the hardcoded case. Phase 5 will replace the
// makeHardcodedCase() call with the LLM generation + validation pipeline,
// without changing anything else in this file.
router.post("/generate", (req, res) => {
  const caseWorld = makeHardcodedCase();
  const caseId = createSession(caseWorld);
  const session = getSession(caseId);
  res.json({ caseId, playerView: buildPlayerView(session) });
});

export default router;
