// In-memory session store. No database for MVP (v3 §4/§10).
//
// Each entry holds the full CaseWorld (including private solution/edges,
// which never leave this file's scope) plus per-session play state:
// what's been discovered, remaining question budget, and interrogation
// history. Evicted after TTL_MS of inactivity.

import { randomUUID } from "crypto";

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const STARTING_QUESTION_BUDGET = 12;

const store = new Map();

let sweepTimer = null;
function ensureSweeping() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [caseId, session] of store) {
      if (now - session.lastTouchedAt > TTL_MS) store.delete(caseId);
    }
  }, 10 * 60 * 1000); // sweep every 10 min
  sweepTimer.unref?.();
}

export function createSession(caseWorld, { fallbackServed = false } = {}) {
  ensureSweeping();
  const caseId = randomUUID();
  store.set(caseId, {
    caseId,
    caseWorld,
    discoveredEvidenceIds: new Set(),
    discoveredEventIds: new Set(),
    questionBudget: STARTING_QUESTION_BUDGET,
    interrogationHistory: [],
    fallbackServed,
    createdAt: Date.now(),
    lastTouchedAt: Date.now(),
  });
  return caseId;
}

export function getSession(caseId) {
  const session = store.get(caseId);
  if (!session) return null;
  session.lastTouchedAt = Date.now();
  return session;
}

export function deleteSession(caseId) {
  store.delete(caseId);
}

// Test-only helper.
export function _clearAllForTests() {
  store.clear();
}
