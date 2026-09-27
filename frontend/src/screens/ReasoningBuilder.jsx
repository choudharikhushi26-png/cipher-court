import { useState } from "react";
import { useGameState, useGameDispatch } from "../state/gameStateStore.jsx";
import SuspectCard from "../components/SuspectCard.jsx";

export default function ReasoningBuilder() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const [accusedSuspect, setAccusedSuspect] = useState(null);
  const [statedMotive, setStatedMotive] = useState("");
  const [statedMethod, setStatedMethod] = useState("");

  // Helper lookups
  const evidenceById = Object.fromEntries(state.discoveredEvidence.map((e) => [e.id, e]));
  const suspectById = Object.fromEntries(state.knownSuspects.map((s) => [s.id, s]));

  const canProceed = accusedSuspect && statedMotive.trim() && statedMethod.trim();

  function handleProceed() {
    if (!canProceed) return;
    dispatch({
      type: "SET_ACCUSATION",
      accusation: {
        accused_suspect_id: accusedSuspect,
        claims: state.playerClaims.map((c) => ({
          evidence_id: c.evidence_id,
          claim_type: c.claim_type,
          target_suspect_id: c.suspect_id,
        })),
        stated_motive: statedMotive.trim(),
        stated_method: statedMethod.trim(),
      },
    });
    dispatch({ type: "SET_SCREEN", screen: "accusation" });
  }

  return (
    <div className="screen">
      <div className="case-file-header">
        <div className="label">Reasoning Builder</div>
        <h1>Build Your Accusation</h1>
        <div className="subtitle">Select your culprit, state your theory, and review your evidence chain</div>
      </div>

      {/* Step 1: Accused Suspect */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">1. Who is the Culprit?</div>
        <div className="grid-3">
          {state.knownSuspects.map((s) => (
            <SuspectCard
              key={s.id}
              suspect={s}
              selected={accusedSuspect === s.id}
              onClick={() => setAccusedSuspect(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 2: Motive */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">2. What was the Motive?</div>
        <textarea
          value={statedMotive}
          onChange={(e) => setStatedMotive(e.target.value)}
          placeholder="Describe why you believe this suspect committed the crime…"
          rows={3}
        />
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
          Tip: Be specific about the suspect's reason for the crime.
        </p>
      </div>

      {/* Step 3: Method */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">3. How was it Done?</div>
        <textarea
          value={statedMethod}
          onChange={(e) => setStatedMethod(e.target.value)}
          placeholder="Describe how the suspect committed the crime…"
          rows={3}
        />
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
          Tip: Describe the method and circumstances of the crime.
        </p>
      </div>

      {/* Step 4: Evidence Claims Summary */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">4. Your Evidence Chain ({state.playerClaims.length} claims)</div>
        {state.playerClaims.length === 0 ? (
          <div className="empty-state">
            No evidence claims. Go back to the Evidence Board to connect evidence to suspects.
          </div>
        ) : (
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {state.playerClaims.map((claim, i) => (
              <div key={i} className="claim-row">
                <span className="claim-evidence">
                  {evidenceById[claim.evidence_id]?.description?.slice(0, 55) || claim.evidence_id}…
                </span>
                <span className="claim-arrow">→</span>
                <span className={`claim-badge ${claim.claim_type}`}>
                  {claim.claim_type.replace(/_/g, " ")}
                </span>
                <span className="claim-arrow">→</span>
                <span className="claim-suspect">
                  {suspectById[claim.suspect_id]?.name || claim.suspect_id}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interrogation log summary */}
      {state.interrogationHistory.length > 0 && (
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <div className="section-title">Interrogation Notes ({state.interrogationHistory.length} questions asked)</div>
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {state.interrogationHistory.map((entry, i) => {
              const s = state.knownSuspects.find((x) => x.id === entry.suspectId);
              return (
                <div key={i} className="card" style={{ padding: "var(--space-sm) var(--space-md)" }}>
                  <span style={{ fontWeight: 600, color: "var(--accent-gold)", fontFamily: "var(--font-display)" }}>
                    {s?.name || entry.suspectId}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginLeft: "var(--space-sm)" }}>
                    — "{entry.question}"
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-2xl)" }}>
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "evidenceBoard" })}>
          ← Evidence Board
        </button>
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "interrogation" })}>
          Interrogation
        </button>
        <button
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={handleProceed}
        >
          Review Accusation →
        </button>
      </div>
    </div>
  );
}
