// The ONLY function allowed to shape a response that reaches the frontend
// before verdict. Every route must build its response through this file,
// never by forwarding a caseWorld object directly.
//
// Strips: is_culprit, is_red_herring, secret, solution, edges, knowledge
// (full), trigger_keywords — anything that would leak the answer or the
// interrogation fact set. See ARCHITECTURE.md §1 (solution-leakage fix).

export function buildPlayerView(session) {
  const { caseWorld, discoveredEvidenceIds, discoveredEventIds, questionBudget } = session;

  return {
    caseId: session.caseId,
    victim: caseWorld.victim,
    setting: caseWorld.setting,
    locations: caseWorld.locations.map(({ id, name, description }) => ({ id, name, description })),
    discoveredEvents: caseWorld.events
      .filter((e) => discoveredEventIds.has(e.id))
      .map(({ id, time, description, location_id }) => ({ id, time, description, location_id })),
    knownSuspects: caseWorld.suspects.map(({ id, name, relationship_to_victim, alibi_claim }) => ({
      id,
      name,
      relationship_to_victim,
      alibi_claim,
    })), // suspects are known by name from the briefing; only their private fields are withheld
    discoveredEvidence: caseWorld.evidence
      .filter((e) => discoveredEvidenceIds.has(e.id))
      .map(({ id, description, location_id }) => ({ id, description, location_id })),
    questionBudget,
  };
}
