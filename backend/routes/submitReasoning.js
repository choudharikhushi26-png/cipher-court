import { Router } from "express";
import { getSession, deleteSession } from "../lib/caseStore.js";
import { scoreReasoning } from "../lib/reasoningScorer.js";

const router = Router();

router.post("/:caseId/submit-reasoning", (req, res) => {
  const session = getSession(req.params.caseId);
  if (!session) return res.status(404).json({ error: "case_not_found" });

  const reasoning = req.body || {};
  if (!reasoning.accused_suspect_id) {
    return res.status(400).json({ error: "accused_suspect_id_required" });
  }

  const result = scoreReasoning(session.caseWorld, reasoning);

  // This is the ONE point in the whole system where the full case, including
  // solution and private edges, is intentionally released to the client.
  res.json({
    ...result,
    revealedCase: session.caseWorld,
  });

  // Session's job is done; free memory rather than wait for TTL sweep.
  deleteSession(req.params.caseId);
});

export default router;
