// Deterministic fact retrieval (ARCHITECTURE.md §6).
// This never changes when the LLM is wired in later — only the rendering
// step after this does. Retrieval itself has no AI dependency, ever.

function normalize(text) {
  return text.toLowerCase().replace(/[^\w\s:]/g, " ").trim();
}

function tokenize(text) {
  return new Set(normalize(text).split(/\s+/).filter(Boolean));
}

/**
 * @param {string} question
 * @param {{fact_id: string, fact: string, trigger_keywords: string[]}[]} knowledge
 * @returns {{fact_id: string, fact: string, overlap: number}[]} facts with overlap > 0, ranked desc
 */
export function retrieveAllowedFacts(question, knowledge) {
  const tokenSet = tokenize(question);
  const normalizedQuestion = normalize(question);

  const scored = knowledge.map((entry) => {
    let overlap = 0;
    for (const keyword of entry.trigger_keywords) {
      const kw = keyword.toLowerCase();
      // multi-word keywords ("step out") are checked as substrings;
      // single-word keywords are checked against the token set.
      if (kw.includes(" ")) {
        if (normalizedQuestion.includes(kw)) overlap += 1;
      } else if (tokenSet.has(kw)) {
        overlap += 1;
      }
    }
    return { fact_id: entry.fact_id, fact: entry.fact, overlap };
  });

  return scored
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 2); // top 1-2 facts, per spec
}
