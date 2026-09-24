import { Router } from "express";
import { getSession } from "../lib/caseStore.js";
import { buildPlayerView } from "../lib/gameView.js";

const router = Router();

router.post("/:caseId/investigate", (req, res) => {
  const session = getSession(req.params.caseId);
  if (!session) return res.status(404).json({ error: "case_not_found" });

  const { locationId } = req.body || {};
  if (!locationId) return res.status(400).json({ error: "locationId_required" });

  const { caseWorld, discoveredEvidenceIds, discoveredEventIds } = session;
  const validLocation = caseWorld.locations.some((l) => l.id === locationId);
  if (!validLocation) return res.status(400).json({ error: "unknown_location" });

  const newlyDiscoveredEvidence = [];
  for (const ev of caseWorld.evidence) {
    if (ev.location_id === locationId && ev.discoverable_at === "investigation" && !discoveredEvidenceIds.has(ev.id)) {
      discoveredEvidenceIds.add(ev.id);
      newlyDiscoveredEvidence.push({ id: ev.id, description: ev.description, location_id: ev.location_id });
    }
  }
  const newlyDiscoveredEvents = [];
  for (const evt of caseWorld.events) {
    if (evt.location_id === locationId && !discoveredEventIds.has(evt.id)) {
      discoveredEventIds.add(evt.id);
      newlyDiscoveredEvents.push({ id: evt.id, time: evt.time, description: evt.description, location_id: evt.location_id });
    }
  }

  res.json({
    newlyDiscoveredEvidence,
    newlyDiscoveredEvents,
    playerView: buildPlayerView(session),
  });
});

export default router;
