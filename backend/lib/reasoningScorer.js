// Implements the exact v3 §7 scoring formula. Runs entirely against the
// server-held CaseWorld — a PLAYER_REASONING submission is never trusted
// as ground truth about itself, only compared against it.

// Ground-truth edges use `suspect_id`; player claims use `target_suspect_id`.
// Both refer to the same concept, so every key function normalizes through
// this accessor rather than assuming one field name.
function suspectOf(c) {
  return c.suspect_id ?? c.target_suspect_id;
}

function claimKey(c) {
  return `${c.evidence_id}::${c.claim_type}::${suspectOf(c)}`;
}

function pairKey(c) {
  return `${c.evidence_id}::${suspectOf(c)}`;
}

/**
 * @param {object} caseWorld - full case, including private solution/edges
 * @param {object} reasoning - PLAYER_REASONING: {accused_suspect_id, claims[], stated_motive, stated_method}
 */
export function scoreReasoning(caseWorld, reasoning) {
  const { solution, edges } = caseWorld;
  const edgeByKey = new Map(edges.map((e) => [claimKey(e), e]));
  const edgeByPair = new Map(); // pairKey -> edge (for partial-credit lookup)
  for (const e of edges) {
    if (!edgeByPair.has(pairKey(e))) edgeByPair.set(pairKey(e), e);
  }
  const requiredEdges = edges.filter((e) => e.is_required);

  // De-duplicate claims (identical evidence_id+claim_type+target_suspect_id counts once).
  const seenKeys = new Set();
  const dedupedClaims = [];
  for (const claim of reasoning.claims || []) {
    const key = claimKey(claim);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    dedupedClaims.push(claim);
  }

  // Detect contradictory claim pairs: same evidence+suspect claimed as both
  // SUPPORTS_ALIBI and CONTRADICTS. Both instances are marked incorrect.
  const contradictoryPairKeys = new Set();
  const byPair = new Map();
  for (const claim of dedupedClaims) {
    const key = pairKey(claim);
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(claim);
  }
  for (const [key, claimsForPair] of byPair) {
    const types = new Set(claimsForPair.map((c) => c.claim_type));
    if (types.has("SUPPORTS_ALIBI") && types.has("CONTRADICTS")) {
      contradictoryPairKeys.add(key);
    }
  }

  const claimsScored = [];
  let incorrectCount = 0;
  let requiredCorrectCount = 0;

  for (const claim of dedupedClaims) {
    const pKey = pairKey(claim);
    if (contradictoryPairKeys.has(pKey)) {
      claimsScored.push({ claim, result: "incorrect", reason: "contradictory_claims" });
      incorrectCount += 1;
      continue;
    }

    const exactEdge = edgeByKey.get(claimKey(claim));
    if (exactEdge) {
      claimsScored.push({ claim, result: "correct" });
      if (exactEdge.is_required) requiredCorrectCount += 1;
      continue;
    }

    const pairEdge = edgeByPair.get(pKey);
    if (pairEdge) {
      // right evidence + suspect, wrong claim_type
      claimsScored.push({ claim, result: "partial", groundTruthClaimType: pairEdge.claim_type });
      continue;
    }

    claimsScored.push({ claim, result: "incorrect", reason: "no_such_relationship" });
    incorrectCount += 1;
  }

  const correctCulprit = reasoning.accused_suspect_id === solution.culprit_id;
  const motiveCorrect = normalizedEquals(reasoning.stated_motive, solution.motive_text);
  const methodCorrect = normalizedEquals(reasoning.stated_method, solution.method_text);

  const requiredFraction = requiredEdges.length > 0 ? requiredCorrectCount / requiredEdges.length : 0;

  const score =
    50 * (correctCulprit ? 1 : 0) +
    10 * (motiveCorrect ? 1 : 0) +
    10 * (methodCorrect ? 1 : 0) +
    30 * requiredFraction -
    5 * Math.min(incorrectCount, 4);

  return {
    correct_culprit: correctCulprit,
    claims_scored: claimsScored,
    motive_correct: motiveCorrect,
    method_correct: methodCorrect,
    score: Math.max(0, Math.round(score)),
  };
}

// Deliberately loose: exact-string scoring on a free-text motive/method field
// would punish reasonable paraphrasing. MVP uses case-insensitive substring/
// keyword overlap as a practical proxy — documented as heuristic, matching
// the project's honesty standard elsewhere (ARCHITECTURE.md §5).
function normalizedEquals(playerText, truthText) {
  if (!playerText) return false;
  const p = playerText.toLowerCase();
  const truthWords = truthText
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 4); // skip short/common words
  if (truthWords.length === 0) return false;
  const hits = truthWords.filter((w) => p.includes(w)).length;
  return hits / truthWords.length >= 0.4; // needs a real match, not a lucky word
}
