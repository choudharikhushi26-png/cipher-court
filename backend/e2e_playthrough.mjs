// E2E Playthrough — exercises every API endpoint end-to-end.
// Run: node e2e_playthrough.mjs   (backend must be running on :4000)

const BASE = "http://localhost:4000/api";
let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    pass++;
    console.log("  PASS: " + label);
  } else {
    fail++;
    console.error("  FAIL: " + label);
  }
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, data, text };
}

const LEAK_KEYS = ["is_culprit","solution","knowledge","trigger_keywords","is_red_herring","secret"];

function checkNoLeakage(obj, label) {
  const json = JSON.stringify(obj);
  for (const key of LEAK_KEYS) {
    assert(!json.includes('"' + key + '"'), label + " -- no " + key + " leaked");
  }
}

async function run() {
  console.log("\n=== CIPHER COURT -- E2E Playthrough ===\n");

  // 1. Health check
  console.log("-- Health Check --");
  const health = await api("GET", "/health");
  assert(health.status === 200 && health.data && health.data.ok === true, "Health check OK");

  // 2. Generate
  console.log("\n-- Generate Case --");
  const gen = await api("POST", "/case/generate");
  assert(gen.status === 200, "Generate returns 200");
  assert(gen.data !== null, "Generate returns valid JSON");
  assert(typeof gen.data.caseId === "string" && gen.data.caseId.length > 0, "Has caseId");
  assert(gen.data.playerView !== undefined, "Has playerView");

  const pv = gen.data.playerView;
  const caseId = gen.data.caseId;

  assert(typeof pv.victim === "string" && pv.victim.length > 0, "victim is non-empty");
  assert(typeof pv.setting === "string" && pv.setting.length > 0, "setting is non-empty");
  assert(Array.isArray(pv.locations) && pv.locations.length >= 3, "locations >= 3");
  assert(Array.isArray(pv.knownSuspects) && pv.knownSuspects.length >= 3, "knownSuspects >= 3");
  assert(typeof pv.questionBudget === "number" && pv.questionBudget > 0, "questionBudget > 0");

  for (const s of pv.knownSuspects) {
    assert(typeof s.id === "string" && s.id.length > 0, "Suspect " + (s.name||"?") + " has id");
    assert(typeof s.name === "string" && s.name.length > 0, "Suspect " + s.id + " has name");
    assert(typeof s.relationship_to_victim === "string" && s.relationship_to_victim.length > 0, "Suspect " + s.id + " has relationship");
    assert(typeof s.alibi_claim === "string" && s.alibi_claim.length > 0, "Suspect " + s.id + " has alibi_claim");
  }

  for (const loc of pv.locations) {
    assert(typeof loc.id === "string" && loc.id.length > 0, "Location has id");
    assert(typeof loc.name === "string" && loc.name.length > 0, "Location " + loc.id + " has name");
    assert(typeof loc.description === "string" && loc.description.length > 0, "Location " + loc.id + " has description");
  }

  console.log("\n-- Leakage Check: Generate --");
  checkNoLeakage(gen.data, "Generate response");

  // 3. Investigate
  console.log("\n-- Investigation --");
  let totalEvidence = 0;
  let totalEvents = 0;

  for (const loc of pv.locations) {
    const inv = await api("POST", "/case/" + caseId + "/investigate", { locationId: loc.id });
    assert(inv.status === 200, "Investigate " + loc.name + " returns 200");
    assert(inv.data && inv.data.playerView !== undefined, "Investigate " + loc.name + " has playerView");
    const newEv = (inv.data && inv.data.newlyDiscoveredEvidence) || [];
    const newEvt = (inv.data && inv.data.newlyDiscoveredEvents) || [];
    totalEvidence += newEv.length;
    totalEvents += newEvt.length;
    checkNoLeakage(inv.data, "Investigate " + loc.name);
    for (const ev of newEv) {
      assert(typeof ev.id === "string" && ev.id.length > 0, "Evidence has id");
      assert(typeof ev.description === "string" && ev.description.length > 0, "Evidence " + ev.id + " has description");
    }
  }
  assert(totalEvidence > 0, "Discovered " + totalEvidence + " evidence items total");
  console.log("  (Found " + totalEvidence + " evidence, " + totalEvents + " events)");

  // Re-investigate idempotency
  console.log("\n-- Re-investigate (idempotency) --");
  const reinv = await api("POST", "/case/" + caseId + "/investigate", { locationId: pv.locations[0].id });
  assert(reinv.status === 200, "Re-investigate returns 200");
  assert(((reinv.data && reinv.data.newlyDiscoveredEvidence) || []).length === 0, "No new evidence on re-investigate");
  assert(((reinv.data && reinv.data.newlyDiscoveredEvents) || []).length === 0, "No new events on re-investigate");

  const badLoc = await api("POST", "/case/" + caseId + "/investigate", { locationId: "loc_nonexistent" });
  assert(badLoc.status === 400, "Invalid locationId returns 400");

  // 4. Interrogation
  console.log("\n-- Interrogation --");
  const suspect0 = pv.knownSuspects[0];
  const askRes = await api("POST", "/case/" + caseId + "/ask-suspect", {
    suspectId: suspect0.id,
    question: "Where were you at the time of the murder?",
  });
  assert(askRes.status === 200, "Ask suspect returns 200");
  assert(typeof askRes.data.reply === "string" && askRes.data.reply.length > 0, "Reply is non-empty");
  assert(askRes.data.playerView !== undefined, "Ask response has playerView");
  checkNoLeakage(askRes.data, "Ask suspect response");

  const badSus = await api("POST", "/case/" + caseId + "/ask-suspect", { suspectId: "sus_nonexistent", question: "test" });
  assert(badSus.status === 400, "Unknown suspectId returns 400");

  const noQ = await api("POST", "/case/" + caseId + "/ask-suspect", { suspectId: suspect0.id });
  assert(noQ.status === 400, "Missing question returns 400");

  // 5. Submit wrong culprit
  console.log("\n-- Submit Reasoning (wrong culprit) --");
  const gen2 = await api("POST", "/case/generate");
  const caseId2 = gen2.data.caseId;
  const pv2 = gen2.data.playerView;
  const inv2 = await api("POST", "/case/" + caseId2 + "/investigate", { locationId: pv2.locations[0].id });
  const evidence2 = (inv2.data && inv2.data.playerView && inv2.data.playerView.discoveredEvidence) || [];

  const wrongVerdict = await api("POST", "/case/" + caseId2 + "/submit-reasoning", {
    accused_suspect_id: pv2.knownSuspects[0].id,
    claims: evidence2.length > 0 ? [{ evidence_id: evidence2[0].id, claim_type: "PLACES_AT", target_suspect_id: pv2.knownSuspects[0].id }] : [],
    stated_motive: "Wrong test motive",
    stated_method: "Wrong test method",
  });
  assert(wrongVerdict.status === 200, "Wrong culprit submit returns 200");
  assert(typeof wrongVerdict.data.score === "number", "Has score");
  assert(wrongVerdict.data.revealedCase !== undefined, "Has revealedCase");

  const rc = wrongVerdict.data.revealedCase;
  if (pv2.knownSuspects[0].id !== rc.solution.culprit_id) {
    assert(wrongVerdict.data.correct_culprit === false, "Wrong culprit detected");
    assert(wrongVerdict.data.score < 100, "Wrong culprit gets partial score");
    console.log("  Score with wrong culprit: " + wrongVerdict.data.score);
  }
  assert(rc.solution !== undefined, "revealedCase has solution");
  assert(Array.isArray(rc.suspects), "revealedCase has suspects");
  assert(rc.suspects.some(function(s) { return s.is_culprit === true; }), "revealedCase has culprit");
  assert(Array.isArray(rc.edges), "revealedCase has edges");
  assert(Array.isArray(rc.evidence), "revealedCase has evidence");

  // 6. Scoring math check
  console.log("\n-- Submit Reasoning (scoring check) --");
  const gen3 = await api("POST", "/case/generate");
  const caseId3 = gen3.data.caseId;
  const pv3 = gen3.data.playerView;
  for (const loc of pv3.locations) {
    await api("POST", "/case/" + caseId3 + "/investigate", { locationId: loc.id });
  }
  const probeVerdict = await api("POST", "/case/" + caseId3 + "/submit-reasoning", {
    accused_suspect_id: pv3.knownSuspects[0].id,
    claims: [],
    stated_motive: "probe",
    stated_method: "probe",
  });
  assert(probeVerdict.status === 200, "Probe submit returns 200");
  assert(typeof probeVerdict.data.score === "number", "Has score");
  assert(probeVerdict.data.score >= 0 && probeVerdict.data.score <= 100, "Score in [0,100]: " + probeVerdict.data.score);
  assert(Array.isArray(probeVerdict.data.claims_scored), "Has claims_scored");
  assert(typeof probeVerdict.data.correct_culprit === "boolean", "Has correct_culprit");
  assert(typeof probeVerdict.data.motive_correct === "boolean", "Has motive_correct");
  assert(typeof probeVerdict.data.method_correct === "boolean", "Has method_correct");

  // 7. Duplicate claims dedup
  console.log("\n-- Edge Case: Duplicate Claims --");
  const gen7 = await api("POST", "/case/generate");
  const caseId7 = gen7.data.caseId;
  const pv7 = gen7.data.playerView;
  for (const loc of pv7.locations) {
    await api("POST", "/case/" + caseId7 + "/investigate", { locationId: loc.id });
  }
  const inv7 = await api("POST", "/case/" + caseId7 + "/investigate", { locationId: pv7.locations[0].id });
  const ev7 = (inv7.data && inv7.data.playerView && inv7.data.playerView.discoveredEvidence) || [];
  if (ev7.length > 0) {
    const dupClaim = { evidence_id: ev7[0].id, claim_type: "PLACES_AT", target_suspect_id: pv7.knownSuspects[0].id };
    const dupVerdict = await api("POST", "/case/" + caseId7 + "/submit-reasoning", {
      accused_suspect_id: pv7.knownSuspects[0].id,
      claims: [dupClaim, dupClaim, dupClaim],
      stated_motive: "test",
      stated_method: "test",
    });
    assert(dupVerdict.status === 200, "Duplicate claims submit returns 200");
    const scoredCount = (dupVerdict.data.claims_scored && dupVerdict.data.claims_scored.length) || 0;
    assert(scoredCount === 1, "Duplicate claims deduped: " + scoredCount + " scored (expected 1)");
  } else {
    console.log("  (No evidence found, skipping dedup test)");
  }

  // 8. Question budget exhaustion
  console.log("\n-- Edge Case: Question Budget Exhaustion --");
  const gen8 = await api("POST", "/case/generate");
  const caseId8 = gen8.data.caseId;
  const pv8 = gen8.data.playerView;
  const budget = pv8.questionBudget;
  let lastBudget = budget;
  for (let i = 0; i < budget; i++) {
    const askR = await api("POST", "/case/" + caseId8 + "/ask-suspect", {
      suspectId: pv8.knownSuspects[0].id,
      question: "Question number " + (i + 1),
    });
    assert(askR.status === 200, "Question " + (i+1) + "/" + budget + " succeeds");
    lastBudget = (askR.data && askR.data.playerView && askR.data.playerView.questionBudget) || 0;
  }
  assert(lastBudget === 0, "Budget exhausted (remaining: " + lastBudget + ")");

  const overBudget = await api("POST", "/case/" + caseId8 + "/ask-suspect", {
    suspectId: pv8.knownSuspects[0].id,
    question: "This should fail",
  });
  assert(overBudget.status === 400, "Over-budget returns 400 (not crash)");
  assert(overBudget.data && overBudget.data.error === "question_budget_exhausted", "Error is question_budget_exhausted");

  // 9. Case not found
  console.log("\n-- Edge Case: Case Not Found --");
  const noCase = await api("POST", "/case/nonexistent-uuid/investigate", { locationId: "loc_1" });
  assert(noCase.status === 404, "Unknown caseId returns 404");

  // 10. Missing accused_suspect_id
  console.log("\n-- Edge Case: Missing accused_suspect_id --");
  const gen9 = await api("POST", "/case/generate");
  const noAccused = await api("POST", "/case/" + gen9.data.caseId + "/submit-reasoning", {
    claims: [],
    stated_motive: "test",
    stated_method: "test",
  });
  assert(noAccused.status === 400, "Missing accused_suspect_id returns 400");

  // Summary
  console.log("\n===========================================");
  console.log("  RESULTS: " + pass + " passed, " + fail + " failed");
  console.log("===========================================\n");
  if (fail > 0) process.exit(1);
}

run().catch(function(err) {
  console.error("E2E playthrough crashed:", err);
  process.exit(1);
});
