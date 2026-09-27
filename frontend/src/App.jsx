import "./index.css";
import { GameStateProvider, useGameState, useGameDispatch } from "./state/gameStateStore.jsx";

import Landing from "./screens/Landing.jsx";
import Briefing from "./screens/Briefing.jsx";
import Investigation from "./screens/Investigation.jsx";
import EvidenceBoard from "./screens/EvidenceBoard.jsx";
import Interrogation from "./screens/Interrogation.jsx";
import ReasoningBuilder from "./screens/ReasoningBuilder.jsx";
import Accusation from "./screens/Accusation.jsx";
import Verdict from "./screens/Verdict.jsx";
import Reveal from "./screens/Reveal.jsx";

const SCREEN_LABELS = {
  landing: null,
  briefing: "Briefing",
  investigation: "Investigation",
  evidenceBoard: "Evidence Board",
  interrogation: "Interrogation",
  reasoningBuilder: "Reasoning",
  accusation: "Accusation",
  verdict: "Verdict",
  reveal: "Reveal",
};

function ScreenRouter() {
  const state = useGameState();

  switch (state.currentScreen) {
    case "landing":
      return <Landing />;
    case "briefing":
      return <Briefing />;
    case "investigation":
      return <Investigation />;
    case "evidenceBoard":
      return <EvidenceBoard />;
    case "interrogation":
      return <Interrogation />;
    case "reasoningBuilder":
      return <ReasoningBuilder />;
    case "accusation":
      return <Accusation />;
    case "verdict":
      return <Verdict />;
    case "reveal":
      return <Reveal />;
    default:
      return <Landing />;
  }
}

function NavBar() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const label = SCREEN_LABELS[state.currentScreen];

  // Don't show nav on landing
  if (!label) return null;

  return (
    <nav className="nav-bar">
      <div className="nav-title">Cipher Court</div>
      <div className="nav-step">{label}</div>
      <div className="nav-actions">
        {state.currentScreen !== "verdict" && state.currentScreen !== "reveal" && (
          <button
            className="btn btn-sm btn-danger"
            onClick={() => dispatch({ type: "NEW_GAME" })}
          >
            Abandon Case
          </button>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <GameStateProvider>
      <NavBar />
      <ScreenRouter />
    </GameStateProvider>
  );
}
