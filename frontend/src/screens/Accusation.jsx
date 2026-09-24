import { useState } from "react";
import { useGameState, useGameDispatch } from "../state/gameStateStore.js";
import { submitReasoning } from "../lib/apiClient.js";

export default function Accusation() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const accusation = state.accusation;
  if (!accusation) {
    return (
      <div className="screen">
        <div className="empty-state">
          <p>No accusation prepared. Go back to the Reasoning Builder.</p>
          <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "reasoningBuilder" })} style={{ marginTop: "var(--space-md)" }}>
            ← Reasoning Builder
          </button>
        </div>
      </div>
    );
  }

  const accusedSuspect = state.knownSuspects.find((s) => s.id === accusation.accused_suspect_id);
  const evidenceById = Object.fromEntries(state.discoveredEvidence.map((e) => [e.id, e]));
  const suspectById = Object.fromEntries(state.knownSuspects.map((s) => [s.id, s]));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitReasoning(state.caseId, accusation);
      dispatch({ type: "VERDICT_RECEIVED", result });
    } catch (err) {
      setError(err.message || "Failed to submit reasoning.");
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <div className="case-file-header">
        <div className="label">Final Accusation</div>
        <h1>Confirm Your Case</h1>
        <div className="subtitle">Review your accusation carefully. This cannot be undone.</div>
      </div>

      {/* Accused */}
      <div className="card" style={{ padding: "var(--space-xl)", marginBottom: "var(--space-xl)", border: "1px solid var(--accent-red-dim)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent-red)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "var(--space-sm)" }}>
          Accused Culprit
        </div>
        <h2 style={{ color: "var(--accent-gold)" }}>{accusedSuspect?.name || accusation.accused_suspect_id}</h2>
        <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
          {accusedSuspect?.relationship_to_victim}
        </p>
      </div>

      {/* Motive */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Stated Motive</div>
        <div className="card" style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>
          "{accusation.stated_motive}"
        </div>
      </div>

      {/* Method */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Stated Method</div>
        <div className="card" style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>
          "{accusation.stated_method}"
        </div>
      </div>

      {/* Evidence Claims */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Evidence Chain ({accusation.claims.length} claims)</div>
        {accusation.claims.length === 0 ? (
          <div className="empty-state">No evidence claims — your score will reflect only culprit, motive, and method.</div>
        ) : (
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {accusation.claims.map((claim, i) => (
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
                  {suspectById[claim.target_suspect_id]?.name || claim.target_suspect_id}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error-msg" style={{ marginBottom: "var(--space-md)" }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-2xl)" }}>
        <button
          className="btn"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "reasoningBuilder" })}
          disabled={submitting}
        >
          ← Go Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
          style={{ fontSize: "1rem", padding: "0.9rem 2.5rem" }}
        >
          {submitting ? (
            <>
              <span className="loading-spinner" /> Submitting…
            </>
          ) : (
            "⟐ Submit Accusation"
          )}
        </button>
      </div>

      <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "var(--space-md)", fontStyle: "italic" }}>
        Once submitted, the court will render its verdict. There is no going back.
      </p>
    </div>
  );
}
