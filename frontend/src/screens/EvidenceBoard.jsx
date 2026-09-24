import { useState } from "react";
import { useGameState, useGameDispatch } from "../state/gameStateStore.js";
import EvidenceCard from "../components/EvidenceCard.jsx";
import SuspectCard from "../components/SuspectCard.jsx";
import ClaimPicker from "../components/ClaimPicker.jsx";

export default function EvidenceBoard() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [selectedClaimType, setSelectedClaimType] = useState(null);
  const [selectedSuspect, setSelectedSuspect] = useState(null);

  function handleAddClaim() {
    if (!selectedEvidence || !selectedClaimType || !selectedSuspect) return;
    dispatch({
      type: "ADD_CLAIM",
      claim: {
        evidence_id: selectedEvidence,
        suspect_id: selectedSuspect,
        claim_type: selectedClaimType,
      },
    });
    // Reset selections
    setSelectedEvidence(null);
    setSelectedClaimType(null);
    setSelectedSuspect(null);
  }

  function handleRemoveClaim(index) {
    dispatch({ type: "REMOVE_CLAIM", index });
  }

  // Helper lookups
  const evidenceById = Object.fromEntries(state.discoveredEvidence.map((e) => [e.id, e]));
  const suspectById = Object.fromEntries(state.knownSuspects.map((s) => [s.id, s]));

  return (
    <div className="screen" style={{ maxWidth: "1100px" }}>
      <div className="case-file-header">
        <div className="label">Evidence Board</div>
        <h1>Build Your Case</h1>
        <div className="subtitle">Connect evidence to suspects through reasoning claims</div>
      </div>

      {/* Claim Builder */}
      <div className="card" style={{ padding: "var(--space-xl)", marginBottom: "var(--space-xl)", border: "1px solid var(--border-medium)" }}>
        <h3 style={{ marginBottom: "var(--space-lg)", color: "var(--accent-gold)" }}>
          ⟐ New Reasoning Claim
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: "var(--space-lg)", alignItems: "start" }}>
          {/* Step 1: Evidence */}
          <div>
            <label>1. Select Evidence</label>
            <div className="flex-col" style={{ gap: "var(--space-sm)", maxHeight: "300px", overflowY: "auto" }}>
              {state.discoveredEvidence.map((ev) => (
                <EvidenceCard
                  key={ev.id}
                  evidence={ev}
                  selected={selectedEvidence === ev.id}
                  onClick={() => setSelectedEvidence(ev.id)}
                />
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ alignSelf: "center", color: "var(--text-muted)", fontSize: "1.5rem", paddingTop: "1.5rem" }}>→</div>

          {/* Step 2: Claim Type */}
          <div>
            <label>2. Claim Type</label>
            <ClaimPicker selectedType={selectedClaimType} onSelect={setSelectedClaimType} />
          </div>

          {/* Arrow */}
          <div style={{ alignSelf: "center", color: "var(--text-muted)", fontSize: "1.5rem", paddingTop: "1.5rem" }}>→</div>

          {/* Step 3: Suspect */}
          <div>
            <label>3. Select Suspect</label>
            <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
              {state.knownSuspects.map((s) => (
                <SuspectCard
                  key={s.id}
                  suspect={s}
                  compact
                  selected={selectedSuspect === s.id}
                  onClick={() => setSelectedSuspect(s.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "var(--space-lg)", textAlign: "center" }}>
          <button
            className="btn btn-primary"
            disabled={!selectedEvidence || !selectedClaimType || !selectedSuspect}
            onClick={handleAddClaim}
          >
            + Add Claim
          </button>
        </div>
      </div>

      {/* Current Claims */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Your Reasoning Claims ({state.playerClaims.length})</div>
        {state.playerClaims.length === 0 ? (
          <div className="empty-state">
            No claims yet. Connect evidence to suspects above to build your case.
          </div>
        ) : (
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {state.playerClaims.map((claim, i) => (
              <div key={i} className="claim-row">
                <span className="claim-evidence">
                  {evidenceById[claim.evidence_id]?.description?.slice(0, 50) || claim.evidence_id}…
                </span>
                <span className="claim-arrow">→</span>
                <span className={`claim-badge ${claim.claim_type}`}>
                  {claim.claim_type.replace(/_/g, " ")}
                </span>
                <span className="claim-arrow">→</span>
                <span className="claim-suspect">
                  {suspectById[claim.suspect_id]?.name || claim.suspect_id}
                </span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleRemoveClaim(i)}
                  style={{ marginLeft: "auto" }}
                >
                  ✗
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-2xl)" }}>
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "investigation" })}>
          ← Investigation
        </button>
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "interrogation" })}>
          Interrogate Suspects
        </button>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "reasoningBuilder" })}
        >
          Build Final Reasoning →
        </button>
      </div>
    </div>
  );
}
