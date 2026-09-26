// Phase 2 — Case generation via Google Gemini API.
// Implements: LLM call → validate → retry once on failure → fallback.
// Never touches the frontend. Reads GEMINI_API_KEY from process.env.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildSystemPrompt, buildGenerationPrompt } from "./promptBuilder.js";
import { validateRaw, validateCase } from "./graphValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FALLBACK_PATH = join(__dirname, "fallbackCases.json");

/**
 * Load a random fallback case from fallbackCases.json.
 * @returns {Promise<{caseWorld: object, fallbackServed: true}>}
 */
async function loadFallback() {
  const raw = await readFile(FALLBACK_PATH, "utf-8");
  const cases = JSON.parse(raw);
  const pick = cases[Math.floor(Math.random() * cases.length)];
  return { caseWorld: pick, fallbackServed: true };
}

/**
 * Call the Gemini API to generate a case.
 * @param {object} [options]
 * @param {string} [options.retryFeedback] - Validation errors from a previous attempt.
 * @returns {Promise<string>} Raw text output from the model.
 */
async function callGemini(options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Set it as an environment variable before running."
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    systemInstruction: buildSystemPrompt(),
    generationConfig: {
      temperature: 1.0,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const prompt = buildGenerationPrompt({
    retryFeedback: options.retryFeedback,
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

const RETRY_DELAY_MS = 15_000; // 15s — stay under free-tier 5 RPM

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a case with the full pipeline:
 *   1. Call Gemini
 *   2. Validate (parseJSON → schema → graph → solution → uniqueness → discoverability)
 *   3. On failure: wait 15s, retry once with error feedback
 *   4. On second failure: load fallback
 *
 * @returns {Promise<{caseWorld: object, fallbackServed: boolean, attempts: Array}>}
 *   attempts: array of { attemptNumber, valid, errors, stages, durationMs }
 */
export async function generateCase() {
  const attempts = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Rate-limit delay before retry
    if (attempt === 2) {
      await sleep(RETRY_DELAY_MS);
    }

    const startMs = Date.now();
    let raw;

    try {
      const retryFeedback =
        attempt === 2 && attempts[0]
          ? attempts[0].errors.join("\n")
          : undefined;

      raw = await callGemini({ retryFeedback });
    } catch (apiError) {
      const durationMs = Date.now() - startMs;
      attempts.push({
        attemptNumber: attempt,
        valid: false,
        errors: [`API error: ${apiError.message}`],
        stages: [],
        durationMs,
      });
      // If first attempt API-errored, try once more; if second, fall through to fallback
      if (attempt === 1) continue;
      break;
    }

    const durationMs = Date.now() - startMs;
    const result = validateRaw(raw);

    attempts.push({
      attemptNumber: attempt,
      valid: result.valid,
      errors: result.errors,
      stages: result.stages.map((s) => ({
        stage: s.stage,
        ok: s.ok,
        errors: s.errors,
      })),
      durationMs,
    });

    if (result.valid) {
      return {
        caseWorld: result.data,
        fallbackServed: false,
        attempts,
      };
    }

    // If first attempt failed validation, the loop continues to attempt 2
    // with retryFeedback containing the errors.
  }

  // Both attempts failed — fallback
  console.warn(
    `[caseGenerator] Both generation attempts failed. Loading fallback case.`
  );
  const fallback = await loadFallback();
  return {
    caseWorld: fallback.caseWorld,
    fallbackServed: true,
    attempts,
  };
}
