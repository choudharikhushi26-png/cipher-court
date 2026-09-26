// Validation pipeline (v3 §5) — full six-stage pipeline for AI-generated cases.
// Each stage returns { ok: boolean, errors: string[], stage: string }.
// The pipeline runner collects results per-stage for transparent checkpoint reporting.

const VALID_CLAIM_TYPES = new Set([
  "PLACES_AT",
  "CONTRADICTS",
  "ESTABLISHES_MOTIVE",
  "ESTABLISHES_METHOD",
  "SUPPORTS_ALIBI",
]);

// ─── Stage 1: parseJSON ─────────────────────────────────────────────

/**
 * Parse raw LLM output into a JSON object.
 * Handles common LLM quirks: markdown fences, trailing text, BOM.
 * @param {string} raw
 * @returns {{ ok: boolean, errors: string[], stage: string, data?: object }}
 */
export function parseJSON(raw) {
  const stage = "parseJSON";
  if (!raw || typeof raw !== "string") {
    return { ok: false, errors: ["Raw output is empty or not a string"], stage };
  }

  // Strip markdown fences if present
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^\uFEFF/, ""); // BOM
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "");
  cleaned = cleaned.trim();

  // Try to extract the JSON object if there's surrounding text
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Strip trailing commas before ] or } (common LLM JSON quirk)
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");

  try {
    const data = JSON.parse(cleaned);
    if (typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, errors: ["Parsed JSON is not an object"], stage };
    }
    return { ok: true, errors: [], stage, data };
  } catch (e) {
    return { ok: false, errors: [`JSON parse error: ${e.message}`], stage };
  }
}

// ─── Stage 2: schemaValidation ──────────────────────────────────────

/**
 * Every required field present, correct types, all IDs referenced exist.
 */
export function schemaValidation(caseWorld) {
  const stage = "schemaValidation";
  const errors = [];

  // Top-level required fields
  const requiredStrings = ["victim", "setting"];
  for (const f of requiredStrings) {
    if (typeof caseWorld[f] !== "string" || !caseWorld[f].trim()) {
      errors.push(`Missing or empty top-level field: ${f}`);
    }
  }

  const requiredArrays = ["locations", "events", "suspects", "evidence", "edges"];
  for (const f of requiredArrays) {
    if (!Array.isArray(caseWorld[f]) || caseWorld[f].length === 0) {
      errors.push(`Missing or empty array: ${f}`);
    }
  }

  if (!caseWorld.solution || typeof caseWorld.solution !== "object") {
    errors.push("Missing solution object");
  } else {
    for (const f of ["culprit_id", "motive_text", "method_text"]) {
      if (typeof caseWorld.solution[f] !== "string" || !caseWorld.solution[f].trim()) {
        errors.push(`Missing or empty solution.${f}`);
      }
    }
  }

  // Location schema
  if (Array.isArray(caseWorld.locations)) {
    for (const loc of caseWorld.locations) {
      if (!loc.id) errors.push("Location missing id");
      if (!loc.name) errors.push(`Location ${loc.id || "?"} missing name`);
      if (!loc.description) errors.push(`Location ${loc.id || "?"} missing description`);
    }
  }

  // Event schema
  if (Array.isArray(caseWorld.events)) {
    for (const evt of caseWorld.events) {
      if (!evt.id) errors.push("Event missing id");
      if (!evt.time) errors.push(`Event ${evt.id || "?"} missing time`);
      if (!evt.description) errors.push(`Event ${evt.id || "?"} missing description`);
      if (!evt.location_id) errors.push(`Event ${evt.id || "?"} missing location_id`);
    }
  }

  // Suspect schema
  if (Array.isArray(caseWorld.suspects)) {
    for (const sus of caseWorld.suspects) {
      if (!sus.id) errors.push("Suspect missing id");
      if (!sus.name) errors.push(`Suspect ${sus.id || "?"} missing name`);
      if (!sus.relationship_to_victim) errors.push(`Suspect ${sus.id || "?"} missing relationship_to_victim`);
      if (typeof sus.alibi_claim !== "string" || !sus.alibi_claim.trim()) {
        errors.push(`Suspect ${sus.id || "?"} missing alibi_claim`);
      }
      if (typeof sus.is_culprit !== "boolean") {
        errors.push(`Suspect ${sus.id || "?"} is_culprit is not a boolean`);
      }
      // knowledge array
      if (!Array.isArray(sus.knowledge) || sus.knowledge.length === 0) {
        errors.push(`Suspect ${sus.id || "?"} missing or empty knowledge array`);
      } else {
        for (const k of sus.knowledge) {
          if (!k.fact_id) errors.push(`Knowledge entry for ${sus.id} missing fact_id`);
          if (!k.fact) errors.push(`Knowledge entry ${k.fact_id || "?"} for ${sus.id} missing fact`);
          if (!Array.isArray(k.trigger_keywords) || k.trigger_keywords.length === 0) {
            errors.push(`Knowledge entry ${k.fact_id || "?"} for ${sus.id} missing trigger_keywords`);
          }
        }
      }
    }
  }

  // Evidence schema
  if (Array.isArray(caseWorld.evidence)) {
    for (const ev of caseWorld.evidence) {
      if (!ev.id) errors.push("Evidence missing id");
      if (!ev.description) errors.push(`Evidence ${ev.id || "?"} missing description`);
      if (!ev.location_id) errors.push(`Evidence ${ev.id || "?"} missing location_id`);
      if (!["investigation", "interrogation"].includes(ev.discoverable_at)) {
        errors.push(`Evidence ${ev.id || "?"} has invalid discoverable_at: ${ev.discoverable_at}`);
      }
      if (typeof ev.is_red_herring !== "boolean") {
        errors.push(`Evidence ${ev.id || "?"} is_red_herring is not a boolean`);
      }
    }
  }

  // Edge schema
  if (Array.isArray(caseWorld.edges)) {
    for (const edge of caseWorld.edges) {
      if (!edge.evidence_id) errors.push("Edge missing evidence_id");
      if (!edge.suspect_id) errors.push("Edge missing suspect_id");
      if (!VALID_CLAIM_TYPES.has(edge.claim_type)) {
        errors.push(`Edge has invalid claim_type: ${edge.claim_type}`);
      }
      if (typeof edge.is_required !== "boolean") {
        errors.push(`Edge (${edge.evidence_id}→${edge.suspect_id}) is_required is not a boolean`);
      }
      if (!edge.metadata || typeof edge.metadata !== "object") {
        errors.push(`Edge (${edge.evidence_id}→${edge.suspect_id}) missing metadata object`);
      }
    }
  }

  return { ok: errors.length === 0, errors, stage };
}

// ─── Stage 3: graphValidation ───────────────────────────────────────

/**
 * All IDs referenced in edges exist in the corresponding arrays.
 * Exactly one culprit. Culprit edges coverage. Suspect alibi edges.
 * No self-contradicting required edges.
 */
export function graphValidation(caseWorld) {
  const stage = "graphValidation";
  const errors = [];

  const evidenceIds = new Set((caseWorld.evidence || []).map((e) => e.id));
  const suspectIds = new Set((caseWorld.suspects || []).map((s) => s.id));
  const locationIds = new Set((caseWorld.locations || []).map((l) => l.id));
  const eventIds = new Set((caseWorld.events || []).map((e) => e.id));

  // ID reference integrity for edges
  for (const edge of caseWorld.edges || []) {
    if (!evidenceIds.has(edge.evidence_id))
      errors.push(`Edge references unknown evidence_id: ${edge.evidence_id}`);
    if (!suspectIds.has(edge.suspect_id))
      errors.push(`Edge references unknown suspect_id: ${edge.suspect_id}`);
    if (edge.metadata?.location_id && !locationIds.has(edge.metadata.location_id))
      errors.push(`Edge metadata references unknown location_id: ${edge.metadata.location_id}`);
    if (edge.metadata?.event_id && !eventIds.has(edge.metadata.event_id))
      errors.push(`Edge metadata references unknown event_id: ${edge.metadata.event_id}`);
  }

  // Evidence location_id references
  for (const ev of caseWorld.evidence || []) {
    if (ev.location_id && !locationIds.has(ev.location_id))
      errors.push(`Evidence ${ev.id} references unknown location_id: ${ev.location_id}`);
  }

  // Event location_id references
  for (const evt of caseWorld.events || []) {
    if (evt.location_id && !locationIds.has(evt.location_id))
      errors.push(`Event ${evt.id} references unknown location_id: ${evt.location_id}`);
  }

  // Exactly one culprit
  const culprits = (caseWorld.suspects || []).filter((s) => s.is_culprit === true);
  if (culprits.length === 0) errors.push("No suspect has is_culprit: true");
  if (culprits.length > 1)
    errors.push(`Multiple culprits found: ${culprits.map((c) => c.id).join(", ")}`);

  // solution.culprit_id matches is_culprit suspect
  if (culprits.length === 1 && caseWorld.solution?.culprit_id !== culprits[0].id) {
    errors.push(
      `solution.culprit_id (${caseWorld.solution?.culprit_id}) doesn't match is_culprit suspect (${culprits[0].id})`
    );
  }

  // Culprit edge coverage: ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, PLACES_AT
  if (culprits.length === 1) {
    const culpritId = culprits[0].id;
    const culpritEdges = (caseWorld.edges || []).filter((e) => e.suspect_id === culpritId);
    const types = new Set(culpritEdges.map((e) => e.claim_type));
    if (!types.has("ESTABLISHES_MOTIVE")) errors.push("Culprit has no ESTABLISHES_MOTIVE edge");
    if (!types.has("ESTABLISHES_METHOD")) errors.push("Culprit has no ESTABLISHES_METHOD edge");
    if (!types.has("PLACES_AT")) errors.push("Culprit has no PLACES_AT edge");
  }

  // Every suspect has alibi_claim and at least one SUPPORTS_ALIBI or CONTRADICTS edge
  for (const suspect of caseWorld.suspects || []) {
    const alibiEdges = (caseWorld.edges || []).filter(
      (e) =>
        e.suspect_id === suspect.id &&
        (e.claim_type === "SUPPORTS_ALIBI" || e.claim_type === "CONTRADICTS")
    );
    if (alibiEdges.length === 0)
      errors.push(`Suspect ${suspect.id} has no SUPPORTS_ALIBI or CONTRADICTS edge`);
  }

  // No two is_required edges mutually SUPPORTS_ALIBI and CONTRADICTS for same pair
  const byPair = new Map();
  for (const edge of (caseWorld.edges || []).filter((e) => e.is_required)) {
    const key = `${edge.evidence_id}::${edge.suspect_id}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(edge);
  }
  for (const [key, edges] of byPair) {
    const types = new Set(edges.map((e) => e.claim_type));
    if (types.has("SUPPORTS_ALIBI") && types.has("CONTRADICTS")) {
      errors.push(`Required edges for ${key} include both SUPPORTS_ALIBI and CONTRADICTS`);
    }
  }

  return { ok: errors.length === 0, errors, stage };
}

// ─── Stage 4: solutionValidation ────────────────────────────────────

/**
 * The culprit's alibi must be contradicted. solution fields must be non-trivial.
 */
export function solutionValidation(caseWorld) {
  const stage = "solutionValidation";
  const errors = [];

  const culpritId = caseWorld.solution?.culprit_id;
  if (!culpritId) {
    errors.push("No solution.culprit_id");
    return { ok: false, errors, stage };
  }

  // Culprit should have a CONTRADICTS edge (their alibi is broken)
  const culpritContradicts = (caseWorld.edges || []).filter(
    (e) => e.suspect_id === culpritId && e.claim_type === "CONTRADICTS"
  );
  if (culpritContradicts.length === 0) {
    errors.push("Culprit has no CONTRADICTS edge — their alibi is never broken");
  }

  // Solution text quality
  if (caseWorld.solution.motive_text && caseWorld.solution.motive_text.length < 10) {
    errors.push("solution.motive_text is suspiciously short (< 10 chars)");
  }
  if (caseWorld.solution.method_text && caseWorld.solution.method_text.length < 10) {
    errors.push("solution.method_text is suspiciously short (< 10 chars)");
  }

  return { ok: errors.length === 0, errors, stage };
}

// ─── Stage 5: heuristicUniquenessCheck ──────────────────────────────

/**
 * HEURISTIC: No non-culprit suspect should have ESTABLISHES_MOTIVE + PLACES_AT
 * without a CONTRADICTS edge — this would create an ambiguous second solution.
 * (Tightened from v2 per blueprint §5.)
 */
export function heuristicUniquenessCheck(caseWorld) {
  const stage = "heuristicUniquenessCheck";
  const errors = [];

  const culpritId = caseWorld.solution?.culprit_id;

  for (const suspect of caseWorld.suspects || []) {
    if (suspect.id === culpritId) continue; // skip the real culprit

    const suspectEdges = (caseWorld.edges || []).filter((e) => e.suspect_id === suspect.id);
    const types = new Set(suspectEdges.map((e) => e.claim_type));

    const hasMotive = types.has("ESTABLISHES_MOTIVE");
    const hasPlacement = types.has("PLACES_AT");
    const hasContradiction = types.has("CONTRADICTS");

    if (hasMotive && hasPlacement && !hasContradiction) {
      errors.push(
        `HEURISTIC: Suspect ${suspect.id} (${suspect.name}) has both ESTABLISHES_MOTIVE and PLACES_AT edges but no CONTRADICTS edge — ambiguous second solution risk`
      );
    }
  }

  return { ok: errors.length === 0, errors, stage };
}

// ─── Stage 6: discoverabilityCheck ──────────────────────────────────

/**
 * HEURISTIC: Every is_required:true edge's evidence must have a valid
 * discoverable_at field. This is a reachability proxy, not a full
 * playthrough simulation. (Blueprint §5.)
 */
export function discoverabilityCheck(caseWorld) {
  const stage = "discoverabilityCheck";
  const errors = [];
  const evidenceMap = new Map((caseWorld.evidence || []).map((e) => [e.id, e]));

  for (const edge of (caseWorld.edges || []).filter((e) => e.is_required)) {
    const ev = evidenceMap.get(edge.evidence_id);
    if (!ev) continue; // covered by graphValidation
    if (!ev.discoverable_at) {
      errors.push(`Required edge evidence ${edge.evidence_id} has no discoverable_at`);
    }
    if (!["investigation", "interrogation"].includes(ev.discoverable_at)) {
      errors.push(
        `Required edge evidence ${edge.evidence_id} has invalid discoverable_at: ${ev.discoverable_at}`
      );
    }
  }

  // Check that at least some required evidence is discoverable via investigation
  // (so the game isn't blocked behind interrogation-only evidence)
  const requiredEvidenceIds = new Set(
    (caseWorld.edges || []).filter((e) => e.is_required).map((e) => e.evidence_id)
  );
  const investigationDiscoverable = [...requiredEvidenceIds].filter((id) => {
    const ev = evidenceMap.get(id);
    return ev && ev.discoverable_at === "investigation";
  });
  if (requiredEvidenceIds.size > 0 && investigationDiscoverable.length === 0) {
    errors.push("No required evidence is discoverable via investigation — game would be stuck");
  }

  return { ok: errors.length === 0, errors, stage };
}

// ─── Full Pipeline Runner ───────────────────────────────────────────

/**
 * Run the full validation pipeline on a parsed case object.
 * Returns detailed per-stage results for checkpoint reporting.
 * @param {object} caseWorld
 * @returns {{ valid: boolean, errors: string[], stages: Array<{stage: string, ok: boolean, errors: string[]}> }}
 */
export function validateCase(caseWorld) {
  const pipeline = [
    schemaValidation,
    graphValidation,
    solutionValidation,
    heuristicUniquenessCheck,
    discoverabilityCheck,
  ];

  const stages = [];
  const allErrors = [];

  for (const check of pipeline) {
    const result = check(caseWorld);
    stages.push(result);
    allErrors.push(...result.errors);
  }

  return { valid: allErrors.length === 0, errors: allErrors, stages };
}

/**
 * Run the complete pipeline starting from raw text.
 * Combines parseJSON + validateCase.
 * @param {string} rawOutput
 * @returns {{ valid: boolean, errors: string[], stages: Array, data?: object }}
 */
export function validateRaw(rawOutput) {
  const parseResult = parseJSON(rawOutput);
  if (!parseResult.ok) {
    return {
      valid: false,
      errors: parseResult.errors,
      stages: [parseResult],
      data: undefined,
    };
  }

  const caseWorld = parseResult.data;
  const validationResult = validateCase(caseWorld);

  return {
    valid: validationResult.valid,
    errors: validationResult.errors,
    stages: [parseResult, ...validationResult.stages],
    data: caseWorld,
  };
}
