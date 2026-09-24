// Central game state store using React context.
// Mirrors safe state to localStorage on every change.

import { createContext, useContext, useReducer, useEffect } from "react";
import { saveGameState, loadGameState, clearGameState } from "./persistence.js";

const GameStateContext = createContext(null);
const GameDispatchContext = createContext(null);

const SCREENS = [
  "landing",
  "briefing",
  "investigation",
  "evidenceBoard",
  "interrogation",
  "reasoningBuilder",
  "accusation",
  "verdict",
  "reveal",
];

function initialState() {
  return {
    currentScreen: "landing",
    caseId: null,
    victim: null,
    setting: null,
    locations: [],
    discoveredEvidence: [],
    discoveredEvents: [],
    knownSuspects: [],
    playerClaims: [],
    interrogationHistory: [],
    questionBudget: 12,
    // Post-verdict (not persisted)
    accusation: null,
    verdictResult: null,
    revealedCase: null,
  };
}

function gameReducer(state, action) {
  switch (action.type) {
    case "RESTORE_STATE":
      return { ...initialState(), ...action.payload, verdictResult: null, revealedCase: null, accusation: null };

    case "SET_SCREEN":
      return { ...state, currentScreen: action.screen };

    case "CASE_LOADED": {
      const { caseId, playerView } = action.payload;
      return {
        ...state,
        caseId,
        victim: playerView.victim,
        setting: playerView.setting,
        locations: playerView.locations || [],
        knownSuspects: playerView.knownSuspects || [],
        discoveredEvidence: playerView.discoveredEvidence || [],
        discoveredEvents: playerView.discoveredEvents || [],
        questionBudget: playerView.questionBudget ?? 12,
        currentScreen: "briefing",
      };
    }

    case "INVESTIGATION_RESULT": {
      const { playerView } = action.payload;
      return {
        ...state,
        discoveredEvidence: playerView.discoveredEvidence || [],
        discoveredEvents: playerView.discoveredEvents || [],
        questionBudget: playerView.questionBudget ?? state.questionBudget,
      };
    }

    case "INTERROGATION_RESULT": {
      const { reply, playerView } = action.payload;
      const suspectId = action.suspectId;
      const question = action.question;
      return {
        ...state,
        interrogationHistory: [
          ...state.interrogationHistory,
          { suspectId, question, reply },
        ],
        questionBudget: playerView.questionBudget ?? state.questionBudget,
      };
    }

    case "ADD_CLAIM": {
      const { evidence_id, suspect_id, claim_type } = action.claim;
      // Prevent exact duplicates
      const exists = state.playerClaims.some(
        (c) =>
          c.evidence_id === evidence_id &&
          c.suspect_id === suspect_id &&
          c.claim_type === claim_type
      );
      if (exists) return state;
      return {
        ...state,
        playerClaims: [...state.playerClaims, { evidence_id, suspect_id, claim_type }],
      };
    }

    case "REMOVE_CLAIM": {
      const idx = action.index;
      return {
        ...state,
        playerClaims: state.playerClaims.filter((_, i) => i !== idx),
      };
    }

    case "SET_ACCUSATION":
      return { ...state, accusation: action.accusation };

    case "VERDICT_RECEIVED":
      return {
        ...state,
        verdictResult: action.result,
        revealedCase: action.result.revealedCase,
        currentScreen: "verdict",
      };

    case "NEW_GAME":
      clearGameState();
      return initialState();

    default:
      return state;
  }
}

export function GameStateProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, () => {
    const saved = loadGameState();
    if (saved) {
      return { ...initialState(), ...saved, verdictResult: null, revealedCase: null, accusation: null };
    }
    return initialState();
  });

  // Persist safe state on every change
  useEffect(() => {
    if (state.caseId) {
      saveGameState(state);
    }
  }, [state]);

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={dispatch}>
        {children}
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGameState must be used within GameStateProvider");
  return ctx;
}

export function useGameDispatch() {
  const ctx = useContext(GameDispatchContext);
  if (!ctx) throw new Error("useGameDispatch must be used within GameStateProvider");
  return ctx;
}

export { SCREENS };
