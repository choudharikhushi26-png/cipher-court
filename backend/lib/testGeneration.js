// Phase 2 Checkpoint — Generate 5 test cases and report results.
// Run directly: node lib/testGeneration.js  (reads GEMINI_API_KEY from backend/.env)
// Does NOT touch the frontend or any routes.

import "dotenv/config";
import { generateCase } from "./caseGenerator.js";

const NUM_CASES = 5;
const INTER_CASE_DELAY_MS = 15_000; // 15s between cases for free-tier rate limits

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCheckpoint() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CIPHER COURT — Phase 2 Checkpoint: 5 Case Generation Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY environment variable is not set.");
    console.error("Run with: GEMINI_API_KEY=your-key node lib/testGeneration.js");
    process.exit(1);
  }

  const results = [];

  for (let i = 0; i < NUM_CASES; i++) {
    // Rate-limit delay between cases (skip before case 1)
    if (i > 0) {
      console.log(`\n  ⏳ Waiting ${INTER_CASE_DELAY_MS / 1000}s for rate limit...`);
      await sleep(INTER_CASE_DELAY_MS);
    }

    console.log(`\n── Case ${i + 1} of ${NUM_CASES} ──────────────────────────────────\n`);

    const startMs = Date.now();
    let result;

    try {
      result = await generateCase();
    } catch (err) {
      result = {
        caseWorld: null,
        fallbackServed: true,
        attempts: [{ attemptNumber: 1, valid: false, errors: [`Unhandled: ${err.message}`], stages: [], durationMs: Date.now() - startMs }],
      };
    }

    const totalMs = Date.now() - startMs;

    const outcome = result.fallbackServed
      ? "FALLBACK"
      : result.attempts.length === 1
        ? "PASS (1st try)"
        : "PASS (retry)";

    results.push({
      caseIndex: i + 1,
      outcome,
      totalMs,
      attempts: result.attempts,
      victim: result.caseWorld?.victim || "(fallback)",
      setting: result.caseWorld?.setting || "(fallback)",
    });

    // Print per-case detail
    console.log(`  Outcome:  ${outcome}`);
    console.log(`  Time:     ${(totalMs / 1000).toFixed(1)}s`);
    if (result.caseWorld) {
      console.log(`  Victim:   ${result.caseWorld.victim}`);
      console.log(`  Setting:  ${result.caseWorld.setting}`);
      console.log(`  Suspects: ${(result.caseWorld.suspects || []).map(s => s.name).join(", ")}`);
      console.log(`  Evidence: ${(result.caseWorld.evidence || []).length} items`);
      console.log(`  Edges:    ${(result.caseWorld.edges || []).length}`);
    }

    for (const attempt of result.attempts) {
      const prefix = attempt.valid ? "✓" : "✗";
      console.log(`\n  Attempt ${attempt.attemptNumber}: ${prefix} (${(attempt.durationMs / 1000).toFixed(1)}s)`);

      if (attempt.stages && attempt.stages.length > 0) {
        for (const stage of attempt.stages) {
          const icon = stage.ok ? "  ✓" : "  ✗";
          console.log(`    ${icon} ${stage.stage}`);
          if (!stage.ok) {
            for (const err of stage.errors) {
              console.log(`        → ${err}`);
            }
          }
        }
      }

      if (!attempt.valid && attempt.errors.length > 0 && (!attempt.stages || attempt.stages.length === 0)) {
        for (const err of attempt.errors) {
          console.log(`    → ${err}`);
        }
      }
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────

  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  const passFirst = results.filter((r) => r.outcome === "PASS (1st try)").length;
  const passRetry = results.filter((r) => r.outcome === "PASS (retry)").length;
  const fallback = results.filter((r) => r.outcome === "FALLBACK").length;

  console.log(`  Passed on 1st try:  ${passFirst} / ${NUM_CASES}`);
  console.log(`  Passed on retry:    ${passRetry} / ${NUM_CASES}`);
  console.log(`  Hit fallback:       ${fallback} / ${NUM_CASES}`);
  console.log(`  Total pass rate:    ${passFirst + passRetry} / ${NUM_CASES}`);
  console.log();

  // If any failures, list the error breakdown
  const failedResults = results.filter((r) => r.outcome === "FALLBACK");
  if (failedResults.length > 0) {
    console.log("  ── Failure Details ──\n");
    for (const r of failedResults) {
      console.log(`  Case ${r.caseIndex}:`);
      for (const attempt of r.attempts) {
        console.log(`    Attempt ${attempt.attemptNumber}:`);
        for (const err of attempt.errors) {
          console.log(`      → ${err}`);
        }
      }
    }
  }

  // Per-stage failure frequency
  const stageCounts = {};
  for (const r of results) {
    for (const attempt of r.attempts) {
      for (const stage of attempt.stages || []) {
        if (!stageCounts[stage.stage]) {
          stageCounts[stage.stage] = { total: 0, failed: 0, errors: [] };
        }
        stageCounts[stage.stage].total++;
        if (!stage.ok) {
          stageCounts[stage.stage].failed++;
          stageCounts[stage.stage].errors.push(...stage.errors);
        }
      }
    }
  }

  if (Object.keys(stageCounts).length > 0) {
    console.log("\n  ── Per-Stage Pass Rate ──\n");
    for (const [stage, counts] of Object.entries(stageCounts)) {
      const passRate = ((counts.total - counts.failed) / counts.total * 100).toFixed(0);
      console.log(`    ${stage}: ${counts.total - counts.failed}/${counts.total} passed (${passRate}%)`);
      if (counts.failed > 0) {
        // Deduplicate error messages
        const uniqueErrors = [...new Set(counts.errors)];
        for (const err of uniqueErrors.slice(0, 5)) {
          console.log(`      → ${err}`);
        }
        if (uniqueErrors.length > 5) {
          console.log(`      → ... and ${uniqueErrors.length - 5} more unique errors`);
        }
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

runCheckpoint().catch((err) => {
  console.error("Checkpoint runner crashed:", err);
  process.exit(1);
});
