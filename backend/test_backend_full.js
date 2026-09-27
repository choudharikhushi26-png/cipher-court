// Native fetch in Node 22

const BASE = "http://localhost:4000/api";

const FORBIDDEN_KEYS = ["is_culprit", "solution", "knowledge", "trigger_keywords", "is_red_herring"];

function findForbiddenKeys(obj, path = "") {
  const leaks = [];
  if (!obj || typeof obj !== "object") return leaks;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.includes(key)) {
      leaks.push({ key: currentPath, value });
    }
    if (value && typeof value === "object") {
      leaks.push(...findForbiddenKeys(value, currentPath));
    }
  }
  return leaks;
}

async function runTests() {
  console.log("=== CIPHER COURT BACKEND VERIFICATION SUITE ===\n");
  let allPassed = true;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      allPassed = false;
    }
  }

  // 1. Health check
  console.log("Test 1: Health check");
  const healthRes = await fetch(`${BASE}/health`);
  const healthData = await healthRes.json();
  assert(healthRes.ok && healthData.ok === true, "Health endpoint returns { ok: true }");

  // 2. Case generation (Fallback when GEMINI_API_KEY is not set)
  console.log("\nTest 2: Case Generation & Data Leakage Check (Fallback Case)");
  const genStart = Date.now();
  const genRes = await fetch(`${BASE}/case/generate`, { method: "POST" });
  const genData = await genRes.json();
  const genDuration = Date.now() - genStart;
  assert(genRes.ok && genData.caseId, `Case generated successfully in ${genDuration}ms. caseId: ${genData.caseId}`);
  assert(genData.playerView !== undefined, "Response contains playerView");

  const genLeaks = findForbiddenKeys(genData);
  assert(genLeaks.length === 0, `Generate response has NO leaked keys. (Found: ${JSON.stringify(genLeaks)})`);
  const caseId = genData.caseId;

  // 3. Investigate all locations
  console.log("\nTest 3: Investigation & Leakage Check");
  const locations = genData.playerView.locations;
  assert(locations && locations.length >= 3, `Discovered ${locations.length} locations`);

  let allEvidenceFound = [];
  for (const loc of locations) {
    const invRes = await fetch(`${BASE}/case/${caseId}/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: loc.id }),
    });
    const invData = await invRes.json();
    assert(invRes.ok, `Investigated ${loc.name} (${loc.id})`);
    const invLeaks = findForbiddenKeys(invData);
    assert(invLeaks.length === 0, `Investigation at ${loc.name} has NO leaked keys`);
    if (invData.newlyDiscoveredEvidence) {
      allEvidenceFound.push(...invData.newlyDiscoveredEvidence);
    }
  }
  assert(allEvidenceFound.length >= 4, `Total evidence found across locations: ${allEvidenceFound.length}`);

  // 4. Interrogation
  console.log("\nTest 4: Interrogation & Fact Retrieval");
  const suspects = genData.playerView.knownSuspects;
  assert(suspects && suspects.length >= 3, `Found ${suspects.length} known suspects`);

  const partner = suspects.find(s => s.name.includes("Calloway")) || suspects[0];
  const askRes1 = await fetch(`${BASE}/case/${caseId}/ask-suspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suspectId: partner.id, question: "Where were you around 9:00 PM?" }),
  });
  const askData1 = await askRes1.json();
  assert(askRes1.ok && typeof askData1.reply === "string", `Asked ${partner.name}: "${askData1.reply}"`);
  assert(askData1.matchedFactCount >= 1, `Fact matching succeeded (${askData1.matchedFactCount} matched)`);
  const askLeaks = findForbiddenKeys(askData1);
  assert(askLeaks.length === 0, `Ask response has NO leaked keys`);

  // 5. Perfect Reasoning Scoring (~100)
  console.log("\nTest 5: Scoring Correctness — Perfect Submission");
  // Let's create a new case specifically for perfect scoring test
  const genRes2 = await fetch(`${BASE}/case/generate`, { method: "POST" });
  const genData2 = await genRes2.json();
  const caseId2 = genData2.caseId;

  // Search study and dining to discover needed evidence
  await fetch(`${BASE}/case/${caseId2}/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "loc_study" }),
  });
  await fetch(`${BASE}/case/${caseId2}/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "loc_dining" }),
  });

  const perfectReasoning = {
    accused_suspect_id: "sus_partner",
    stated_motive: "Concealing embezzlement from the business partnership.",
    stated_method: "Confronted Eleanor over the ledger and struck her during their argument in the study.",
    claims: [
      { evidence_id: "evd_ledger", claim_type: "ESTABLISHES_MOTIVE", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_glass", claim_type: "PLACES_AT", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_testimony_note", claim_type: "CONTRADICTS", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_timepiece", claim_type: "ESTABLISHES_METHOD", target_suspect_id: "sus_partner" },
    ],
  };

  const submitRes1 = await fetch(`${BASE}/case/${caseId2}/submit-reasoning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(perfectReasoning),
  });
  const submitData1 = await submitRes1.json();
  assert(submitRes1.ok, "Perfect reasoning submitted successfully");
  assert(submitData1.correct_culprit === true, "Culprit correctly identified (+50)");
  assert(submitData1.motive_correct === true, "Motive correctly matched (+10)");
  assert(submitData1.method_correct === true, "Method correctly matched (+10)");
  assert(submitData1.score === 100, `Perfect score matches formula: expected 100, got ${submitData1.score}`);
  assert(submitData1.revealedCase !== undefined, "Verdict includes revealedCase for post-verdict screen");

  // 6. Deliberately Wrong Scoring (expect 0 or low)
  console.log("\nTest 6: Scoring Correctness — Deliberately Wrong Submission");
  const genRes3 = await fetch(`${BASE}/case/generate`, { method: "POST" });
  const genData3 = await genRes3.json();
  const caseId3 = genData3.caseId;

  const wrongReasoning = {
    accused_suspect_id: "sus_niece", // Wrong culprit
    stated_motive: "Alien abduction conspiracy", // Wrong motive
    stated_method: "Telekinesis", // Wrong method
    claims: [
      { evidence_id: "evd_ledger", claim_type: "SUPPORTS_ALIBI", target_suspect_id: "sus_butler" }, // Wrong claim
      { evidence_id: "evd_glass", claim_type: "CONTRADICTS", target_suspect_id: "sus_niece" }, // Wrong claim
    ],
  };

  const submitRes2 = await fetch(`${BASE}/case/${caseId3}/submit-reasoning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(wrongReasoning),
  });
  const submitData2 = await submitRes2.json();
  assert(submitRes2.ok, "Wrong reasoning submitted without server error");
  assert(submitData2.correct_culprit === false, "Culprit identified as incorrect (+0)");
  assert(submitData2.motive_correct === false, "Motive identified as incorrect (+0)");
  assert(submitData2.method_correct === false, "Method identified as incorrect (+0)");
  // Formula: 0 + 0 + 0 + 0 - 5 * 2 = -10 -> Math.max(0, -10) = 0
  assert(submitData2.score === 0, `Wrong score matches formula (clamped to 0): got ${submitData2.score}`);

  // 7. Duplicate Claims Edge Case
  console.log("\nTest 7: Duplicate Claims Edge Case");
  const genRes4 = await fetch(`${BASE}/case/generate`, { method: "POST" });
  const genData4 = await genRes4.json();
  const caseId4 = genData4.caseId;

  const duplicateClaimsReasoning = {
    accused_suspect_id: "sus_partner",
    stated_motive: "Concealing embezzlement from the business partnership.",
    stated_method: "Confronted Eleanor over the ledger and struck her during their argument in the study.",
    claims: [
      { evidence_id: "evd_ledger", claim_type: "ESTABLISHES_MOTIVE", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_ledger", claim_type: "ESTABLISHES_MOTIVE", target_suspect_id: "sus_partner" }, // Duplicate!
      { evidence_id: "evd_glass", claim_type: "PLACES_AT", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_testimony_note", claim_type: "CONTRADICTS", target_suspect_id: "sus_partner" },
      { evidence_id: "evd_timepiece", claim_type: "ESTABLISHES_METHOD", target_suspect_id: "sus_partner" },
    ],
  };

  const submitRes3 = await fetch(`${BASE}/case/${caseId4}/submit-reasoning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(duplicateClaimsReasoning),
  });
  const submitData3 = await submitRes3.json();
  assert(submitRes3.ok, "Submission with duplicate claims handled without crash");
  assert(submitData3.score === 100, `Duplicates de-duplicated: expected 100, got ${submitData3.score}`);

  // 8. Question Budget Exhaustion Edge Case
  console.log("\nTest 8: Question Budget Exhaustion");
  const genRes5 = await fetch(`${BASE}/case/generate`, { method: "POST" });
  const genData5 = await genRes5.json();
  const caseId5 = genData5.caseId;

  // Ask 12 questions to exhaust budget
  for (let q = 1; q <= 12; q++) {
    const res = await fetch(`${BASE}/case/${caseId5}/ask-suspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspectId: "sus_butler", question: `Question number ${q}?` }),
    });
    assert(res.ok, `Question ${q}/12 asked successfully`);
  }

  // 13th question should return 400 question_budget_exhausted
  const exhaustRes = await fetch(`${BASE}/case/${caseId5}/ask-suspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suspectId: "sus_butler", question: "13th question should fail" }),
  });
  const exhaustData = await exhaustRes.json();
  assert(exhaustRes.status === 400 && exhaustData.error === "question_budget_exhausted",
    `13th question returned 400 question_budget_exhausted: ${JSON.stringify(exhaustData)}`);

  // 9. Invalid / Expired caseId Edge Case
  console.log("\nTest 9: Invalid/Expired Case ID");
  const invalidRes = await fetch(`${BASE}/case/non-existent-uuid-12345/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId: "loc_study" }),
  });
  const invalidData = await invalidRes.json();
  assert(invalidRes.status === 404 && invalidData.error === "case_not_found",
    `Invalid caseId returned 404 case_not_found: ${JSON.stringify(invalidData)}`);

  console.log("\n================================================");
  if (allPassed) {
    console.log("  ALL TESTS PASSED SUCCESSFULLY! (100% GREEN)");
  } else {
    console.error("  SOME TESTS FAILED! Check logs above.");
  }
  console.log("================================================");
}

runTests().catch(err => {
  console.error("Fatal error in test suite:", err);
  process.exit(1);
});
