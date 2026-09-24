// Zero-LLM suspect response rendering. Used for the entire game during
// Phase 2, and reused later (Phase 6) as the last-resort fallback when the
// LLM repeatedly fails to render allowed facts without hallucinating.
// This function can NEVER introduce a fact outside `allowedFacts` because
// it only ever echoes their text back, wrapped in a fixed template.

const DEFLECTIONS = [
  "shrugs. \"I couldn't tell you anything about that.\"",
  "pauses. \"I'm afraid that's not something I know.\"",
  "shakes their head. \"You'll have to ask someone else about that.\"",
];

export function renderSuspectResponse(suspectName, allowedFacts) {
  if (allowedFacts.length === 0) {
    const line = DEFLECTIONS[Math.floor(Math.random() * DEFLECTIONS.length)];
    return `${suspectName} ${line}`;
  }
  const quoted = allowedFacts.map((f) => `"${f.fact}"`).join(" ");
  return `${suspectName} says: ${quoted}`;
}
