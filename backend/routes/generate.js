import { Router } from "express";
import { generateCase } from "../lib/caseGenerator.js";
import { createSession, getSession } from "../lib/caseStore.js";
import { buildPlayerView } from "../lib/gameView.js";

const router = Router();

// Full AI generation pipeline: LLM call → validate → retry → fallback.
// Replaces the Phase 2 hardcoded case with the real generation pipeline.
router.post("/generate", async (req, res) => {
  try {
    const { caseWorld, fallbackServed, attempts } = await generateCase();

    if (fallbackServed) {
      console.warn("[generate] Serving fallback case after failed generation.");
    } else {
      console.log(
        `[generate] AI case generated successfully (attempt ${attempts.length}).`
      );
    }

    const caseId = createSession(caseWorld);
    const session = getSession(caseId);
    res.json({ caseId, playerView: buildPlayerView(session) });
  } catch (err) {
    console.error("[generate] Unexpected error:", err);
    res.status(500).json({ error: "Failed to generate case. Please retry." });
  }
});

export default router;
