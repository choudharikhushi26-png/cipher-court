// localStorage persistence for safe player state only.
// Never stores solution, is_culprit, is_red_herring, or private suspect knowledge.

const STORAGE_KEY = "cipher_court_game_state";

const SAFE_KEYS = [
  "caseId",
  "currentScreen",
  "discoveredEvidence",
  "discoveredEvents",
  "discoveredSuspects",
  "playerClaims",
  "interrogationHistory",
  "questionBudget",
  "locations",
  "victim",
  "setting",
  "knownSuspects",
];

export function saveGameState(state) {
  try {
    const safe = {};
    for (const key of SAFE_KEYS) {
      if (state[key] !== undefined) safe[key] = state[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // localStorage might be full or unavailable — fail silently
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity check: must have a caseId to be valid
    if (!parsed || !parsed.caseId) return null;
    return parsed;
  } catch {
    // Corrupt localStorage — clear and return null
    clearGameState();
    return null;
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
