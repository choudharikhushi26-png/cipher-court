import { Router } from "express";
import { getSession } from "../lib/caseStore.js";
import { buildPlayerView } from "../lib/gameView.js";
import { retrieveAllowedFacts } from "../lib/factRetriever.js";
import { renderSuspectResponse } from "../lib/deterministicRenderer.js";

const router = Router();

router.post("/:caseId/ask-suspect", (req, res) => {
  const session = getSession(req.params.caseId);
  if (!session) return res.status(404).json({ error: "case_not_found" });

  const { suspectId, question } = req.body || {};
  if (!suspectId || !question) return res.status(400).json({ error: "suspectId_and_question_required" });

  if (session.questionBudget <= 0) {
    return res.status(400).json({ error: "question_budget_exhausted" });
  }

  const suspect = session.caseWorld.suspects.find((s) => s.id === suspectId);
  if (!suspect) return res.status(400).json({ error: "unknown_suspect" });

  // Full `suspect.knowledge` (with trigger_keywords) never leaves this route.
  // Only the rendered reply text crosses the wire.
  const allowedFacts = retrieveAllowedFacts(question, suspect.knowledge);
  const reply = renderSuspectResponse(suspect.name, allowedFacts);

  session.questionBudget -= 1;
  session.interrogationHistory.push({ suspectId, question, reply });

  res.json({
    reply,
    matchedFactCount: allowedFacts.length,
    playerView: buildPlayerView(session),
  });
});

export default router;
