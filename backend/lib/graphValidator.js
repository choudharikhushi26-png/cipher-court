// Validation pipeline (v3 §5). Structure built now for the hardcoded case;
// same code validates AI-generated cases in Phase 5.
// Every check returns { ok: boolean, errors: string[] }.

const VALID_CLAIM_TYPES = new Set([
  "PLACES_AT",
  "CONTRADICTS",
  "ESTABLISHES_MOTIVE",
  "ESTABLISHES_METHOD",
  "SUPPORTS_ALIBI",
]);

/** All IDs referenced in edges actually exist in the case arrays. */
function validateIds(caseWorld) {
  const errors = [];
  const evidenceIds = new Set(caseWorld.evidence.map((e) => e.id));
  const suspectIds = new Set(caseWorld.suspects.map((s) => s.id));
  const locationIds = new Set(caseWorld.locations.map((l) => l.id));
  const eventIds = new Set(caseWorld.events.map((e) => e.id));

  for (const edge of caseWorld.edges) {
    if (!evidenceIds.has(edge.evidence_id))
      errors.push(`Edge references unknown evidence_id: ${edge.evidence_id}`);
    if (!suspectIds.has(edge.suspect_id))
      errors.push(`Edge references unknown suspect_id: ${edge.suspect_id}`);
    if (!VALID_CLAIM_TYPES.has(edge.claim_type))
      errors.push(`Edge has invalid claim_type: ${edge.claim_type}`);
    if (edge.metadata?.location_id && !locationIds.has(edge.metadata.location_id))
      errors.push(`Edge metadata references unknown location_id: ${edge.metadata.location_id}`);
    if (edge.metadata?.event_id && !eventIds.has(edge.metadata.event_id))
      errors.push(`Edge metadata references unknown event_id: ${edge.metadata.event_id}`);
  }

  // Evidence location_id references
  for (const ev of caseWorld.evidence) {
    if (ev.location_id && !locationIds.has(ev.location_id))
      errors.push(`Evidence ${ev.id} references unknown location_id: ${ev.location_id}`);
  }

  // Event location_id references
  for (const evt of caseWorld.events) {
    if (evt.location_id && !locationIds.has(evt.location_id))
      errors.push(`Event ${evt.id} references unknown location_id: ${evt.location_id}`);
  }

  return { ok: errors.length === 0, errors };
}

/** Exactly one suspect has is_culprit: true. */
function validateCulprit(caseWorld) {
  const errors = [];
  const culprits = caseWorld.suspects.filter((s) => s.is_culprit);
  if (culprits.length === 0) errors.push("No suspect has is_culprit: true");
  if (culprits.length > 1)
    errors.push(`Multiple culprits found: ${culprits.map((c) => c.id).join(", ")}`);

  // solution.culprit_id must match the is_culprit suspect
  if (culprits.length === 1 && caseWorld.solution?.culprit_id !== culprits[0].id) {
    errors.push(
      `solution.culprit_id (${caseWorld.solution?.culprit_id}) doesn't match is_culprit suspect (${culprits[0].id})`
    );
  }

  return { ok: errors.length === 0, errors };
}

/** Culprit must have at least one ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, and PLACES_AT edge. */
function validateCulpritEdges(caseWorld) {
  const errors = [];
  const culpritId = caseWorld.solution?.culprit_id;
  if (!culpritId) {
    errors.push("No solution.culprit_id defined");
    return { ok: false, errors };
  }

  const culpritEdges = caseWorld.edges.filter((e) => e.suspect_id === culpritId);
  const types = new Set(culpritEdges.map((e) => e.claim_type));

  if (!types.has("ESTABLISHES_MOTIVE"))
    errors.push("Culprit has no ESTABLISHES_MOTIVE edge");
  if (!types.has("ESTABLISHES_METHOD"))
    errors.push("Culprit has no ESTABLISHES_METHOD edge");
  if (!types.has("PLACES_AT")) errors.push("Culprit has no PLACES_AT edge");

  return { ok: errors.length === 0, errors };
}

/** Every suspect has an alibi_claim and at least one SUPPORTS_ALIBI or CONTRADICTS edge. */
function validateSuspectAlibis(caseWorld) {
  const errors = [];
  for (const suspect of caseWorld.suspects) {
    if (!suspect.alibi_claim)
      errors.push(`Suspect ${suspect.id} has no alibi_claim`);

    const alibiEdges = caseWorld.edges.filter(
      (e) =>
        e.suspect_id === suspect.id &&
        (e.claim_type === "SUPPORTS_ALIBI" || e.claim_type === "CONTRADICTS")
    );
    if (alibiEdges.length === 0)
      errors.push(
        `Suspect ${suspect.id} has no SUPPORTS_ALIBI or CONTRADICTS edge`
      );
  }
  return { ok: errors.length === 0, errors };
}

/** No two is_required edges mutually CONTRADICTS (solution can't contradict itself). */
function validateNoSolutionContradiction(caseWorld) {
  const errors = [];
  const requiredContradicts = caseWorld.edges.filter(
    (e) => e.is_required && e.claim_type === "CONTRADICTS"
  );
  // Check if any required CONTRADICTS edge targets the culprit's alibi
  // (which would make the solution self-contradictory — that's expected and valid)
  // The real check: two required edges can't both be CONTRADICTS for the same suspect
  const byPair = new Map();
  for (const edge of caseWorld.edges.filter((e) => e.is_required)) {
    const key = `${edge.evidence_id}::${edge.suspect_id}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(edge);
  }

  for (const [key, edges] of byPair) {
    const types = new Set(edges.map((e) => e.claim_type));
    if (types.has("SUPPORTS_ALIBI") && types.has("CONTRADICTS")) {
      errors.push(
        `Required edges for ${key} include both SUPPORTS_ALIBI and CONTRADICTS`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Required evidence must be discoverable. */
function validateDiscoverability(caseWorld) {
  const errors = [];
  const evidenceMap = new Map(caseWorld.evidence.map((e) => [e.id, e]));

  for (const edge of caseWorld.edges.filter((e) => e.is_required)) {
    const ev = evidenceMap.get(edge.evidence_id);
    if (!ev) continue; // covered by validateIds
    if (!ev.discoverable_at) {
      errors.push(
        `Required edge evidence ${edge.evidence_id} has no discoverable_at`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Suspect knowledge arrays have required fields. */
function validateSuspectKnowledge(caseWorld) {
  const errors = [];
  for (const suspect of caseWorld.suspects) {
    if (!Array.isArray(suspect.knowledge)) {
      errors.push(`Suspect ${suspect.id} has no knowledge array`);
      continue;
    }
    for (const entry of suspect.knowledge) {
      if (!entry.fact_id) errors.push(`Knowledge entry for ${suspect.id} missing fact_id`);
      if (!entry.fact) errors.push(`Knowledge entry ${entry.fact_id} for ${suspect.id} missing fact`);
      if (!Array.isArray(entry.trigger_keywords) || entry.trigger_keywords.length === 0)
        errors.push(`Knowledge entry ${entry.fact_id} for ${suspect.id} missing trigger_keywords`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Run all validation checks.
 * @param {object} caseWorld - full CASE_WORLD
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCase(caseWorld) {
  const checks = [
    validateIds,
    validateCulprit,
    validateCulpritEdges,
    validateSuspectAlibis,
    validateNoSolutionContradiction,
    validateDiscoverability,
    validateSuspectKnowledge,
  ];

  const allErrors = [];
  for (const check of checks) {
    const result = check(caseWorld);
    allErrors.push(...result.errors);
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}
