import { useGameState, useGameDispatch } from "../state/gameStateStore.js";
import ScoreBreakdown from "../components/ScoreBreakdown.jsx";

export default function Verdict() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  if (!state.verdictResult) {
    return (
      <div className="screen">
        <div className="empty-state">
          <p>No verdict available. Submit your accusation first.</p>
          <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "reasoningBuilder" })} style={{ marginTop: "var(--space-md)" }}>
            ← Reasoning Builder
          </button>
        </div>
      </div>
    );
  }

  const { score, correct_culprit } = state.verdictResult;

  return (
    <div className="screen">
      <div className="case-file-header">
        <div className="label">The Court's Verdict</div>
        <h1>
          {correct_culprit
            ? "Justice is Served"
            : "The Culprit Walks Free"}
        </h1>
        <div className="subtitle">
          {correct_culprit
            ? "You identified the right person. But how strong was your case?"
            : "Your accusation was wrong. Review the evidence to see where you went astray."}
        </div>
      </div>

      <ScoreBreakdown
        verdictResult={state.verdictResult}
        knownSuspects={state.knownSuspects}
        discoveredEvidence={state.discoveredEvidence}
      />

      {/* Scoring explanation */}
      <div style={{ marginTop: "var(--space-xl)" }}>
        <div className="section-title">How Scoring Works</div>
        <div className="card" style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          <p style={{ marginBottom: "var(--space-sm)" }}>
            <strong style={{ color: "var(--text-primary)" }}>50 pts</strong> — Correct culprit
          </p>
          <p style={{ marginBottom: "var(--space-sm)" }}>
            <strong style={{ color: "var(--text-primary)" }}>10 pts</strong> — Correct motive
          </p>
          <p style={{ marginBottom: "var(--space-sm)" }}>
            <strong style={{ color: "var(--text-primary)" }}>10 pts</strong> — Correct method
          </p>
          <p style={{ marginBottom: "var(--space-sm)" }}>
            <strong style={{ color: "var(--text-primary)" }}>30 pts</strong> — Proportion of required evidence edges correctly claimed
          </p>
          <p>
            <strong style={{ color: "var(--accent-red)" }}>−5 pts</strong> — Per incorrect claim (max −20)
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-2xl)" }}>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "reveal" })}
        >
          View Full Truth →
        </button>
      </div>
    </div>
  );
}
