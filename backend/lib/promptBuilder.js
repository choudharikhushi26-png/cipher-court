// Phase 2 — Prompt construction for case generation via Gemini.
// Matches the v3 blueprint schema exactly: locations, events, suspects
// (with knowledge/trigger_keywords), evidence (with red-herring flags),
// solution, edges (Evidence→Suspect only, five claim_types).

/**
 * Returns the system instruction for the Gemini model.
 * This never changes across calls — it establishes the role and constraints.
 */
export function buildSystemPrompt() {
  return `You are a mystery-case author for a detective deduction game called Cipher Court.
Your job is to generate a single, self-consistent murder mystery case as a JSON object.

ABSOLUTE RULES:
- Output ONLY a single JSON object. No markdown fences, no commentary, no explanation.
- The JSON must parse cleanly. No trailing commas, no comments inside the JSON.
- Follow the exact schema provided in the user prompt — every field is required.
- Every ID you reference in edges, evidence, or events MUST exist in the corresponding array.
- Exactly ONE suspect must have "is_culprit": true. The others must be false.
- solution.culprit_id MUST match the id of the is_culprit suspect.
- The culprit MUST have at least one edge of each: ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, PLACES_AT.
- Every suspect MUST have an alibi_claim (non-empty string) and at least one SUPPORTS_ALIBI or CONTRADICTS edge.
- No non-culprit suspect should simultaneously have ESTABLISHES_MOTIVE + PLACES_AT edges AND lack a CONTRADICTS edge against them (this would create an ambiguous second solution).
- Red herring evidence should mislead but not create a valid alternative solution.
- Every is_required:true edge's evidence must have a valid discoverable_at value.
- Each suspect must have 2-4 knowledge entries, each with a non-empty trigger_keywords array (3-7 keywords).
- The five valid claim_types are EXACTLY: PLACES_AT, CONTRADICTS, ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, SUPPORTS_ALIBI.
- Generate 3 locations, 3-4 events, 3 suspects, 5-7 evidence items (2+ red herrings), and 6-10 edges.`;
}

/**
 * Builds the user/generation prompt with the full schema and an example shape.
 * @param {object} [options] - Optional parameters for variety.
 * @param {string} [options.theme] - Optional theme hint (e.g. "noir", "gothic", "tech startup").
 * @param {string} [options.retryFeedback] - If retrying, the validation errors from the first attempt.
 * @returns {string}
 */
export function buildGenerationPrompt(options = {}) {
  const theme = options.theme || pickRandomTheme();
  const retrySection = options.retryFeedback
    ? `\n\nIMPORTANT — PREVIOUS ATTEMPT FAILED VALIDATION. Fix these specific errors:\n${options.retryFeedback}\n\nDo NOT repeat the same structural mistakes. Pay careful attention to ID references and edge coverage requirements.`
    : "";

  return `Generate a murder mystery case with the theme: "${theme}".

Output a single JSON object matching this EXACT schema:

{
  "victim": "string — full name of the victim",
  "setting": "string — where and when the case takes place",
  "locations": [
    {"id": "loc_xxx", "name": "string", "description": "string"}
  ],
  "events": [
    {"id": "ev_xxx", "time": "string (e.g. '8:00 PM')", "description": "string", "location_id": "loc_xxx"}
  ],
  "suspects": [
    {
      "id": "sus_xxx",
      "name": "string — full name",
      "relationship_to_victim": "string",
      "alibi_claim": "string — what they claim they were doing",
      "is_culprit": false,
      "secret": "string or null — private information about this suspect",
      "knowledge": [
        {
          "fact_id": "fact_xxx",
          "fact": "string — first-person statement this suspect can reveal",
          "trigger_keywords": ["keyword1", "keyword2", "keyword3"]
        }
      ]
    }
  ],
  "evidence": [
    {
      "id": "evd_xxx",
      "description": "string — what the evidence is",
      "location_id": "loc_xxx",
      "discoverable_at": "investigation or interrogation",
      "is_red_herring": false
    }
  ],
  "solution": {
    "culprit_id": "sus_xxx",
    "motive_text": "string — why the culprit did it",
    "method_text": "string — how the culprit did it"
  },
  "edges": [
    {
      "evidence_id": "evd_xxx",
      "suspect_id": "sus_xxx",
      "claim_type": "PLACES_AT | CONTRADICTS | ESTABLISHES_MOTIVE | ESTABLISHES_METHOD | SUPPORTS_ALIBI",
      "metadata": {
        "location_id": "loc_xxx or null",
        "event_id": "ev_xxx or null",
        "note": "string or null — brief explanation of what this edge means"
      },
      "is_required": true
    }
  ]
}

STRUCTURAL REQUIREMENTS:
1. Generate exactly 3 locations, 3-4 events, exactly 3 suspects, 5-7 evidence items, and 6-10 edges.
2. Exactly 1 suspect has is_culprit:true; the other 2 have is_culprit:false.
3. The culprit MUST have at least one edge each of: ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, PLACES_AT.
4. Every suspect MUST have at least one SUPPORTS_ALIBI or CONTRADICTS edge referencing them.
5. At least 2 evidence items must have is_red_herring:true. Red herrings should plausibly mislead.
6. Non-culprit suspects should NOT have both ESTABLISHES_MOTIVE and PLACES_AT edges unless they also have a CONTRADICTS edge that breaks their case.
7. All is_required:true edges must reference evidence with a valid discoverable_at.
8. Each suspect needs 2-4 knowledge entries. Each knowledge entry needs 3-7 trigger_keywords (lowercase, single words or short phrases a player might type).
9. All IDs must be unique and follow the prefixes: loc_, ev_, sus_, evd_, fact_.
10. solution.culprit_id must exactly match the id of the suspect with is_culprit:true.
11. Edge metadata location_id and event_id must reference existing IDs or be null.
12. The culprit's alibi must be contradicted by at least one piece of evidence (there must be a CONTRADICTS edge for the culprit).
13. The claim_type field must be one of EXACTLY these five strings: PLACES_AT, CONTRADICTS, ESTABLISHES_MOTIVE, ESTABLISHES_METHOD, SUPPORTS_ALIBI.

CONTENT QUALITY:
- Make the mystery interesting and non-obvious. The culprit should not be immediately apparent.
- Red herrings should point convincingly at innocent suspects.
- Knowledge facts should be in first-person voice, as if the suspect is speaking.
- Trigger keywords should be words a player would naturally type when asking about the relevant topic.
- Events should form a coherent timeline.
- Evidence descriptions should be concrete and specific, not vague.

Output ONLY the JSON object. No other text.${retrySection}`;
}

/** Pick a random theme to inject variety into generated cases. */
function pickRandomTheme() {
  const themes = [
    "A 1920s jazz club after a famous singer is found dead backstage",
    "A remote lighthouse where the keeper is murdered during a storm",
    "A prestigious university where a professor is killed in their office",
    "A luxury train journey where a passenger is found dead in their compartment",
    "A film noir-style private detective agency where the lead detective is killed",
    "A Victorian-era country estate where the lord of the manor is poisoned at dinner",
    "A modern tech startup office where the CEO is found dead after a board meeting",
    "An art gallery opening night where the curator is murdered among the exhibits",
    "A 1940s wartime spy thriller where an intelligence officer is killed in a safe house",
    "A mountain ski lodge during a blizzard where a guest is found dead",
    "A grand opera house where the lead performer is killed during intermission",
    "A small coastal town fishing dock where the harbormaster is murdered",
  ];
  return themes[Math.floor(Math.random() * themes.length)];
}
