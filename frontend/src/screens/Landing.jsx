import { useState } from "react";
import { useGameDispatch } from "../state/gameStateStore.jsx";
import { generateCase } from "../lib/apiClient.js";

export default function Landing() {
  const dispatch = useGameDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleNewCase() {
    setLoading(true);
    setError(null);
    try {
      const data = await generateCase();
      dispatch({ type: "CASE_LOADED", payload: data });
    } catch (err) {
      setError(err.message || "Failed to generate case. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", textAlign: "center" }}>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "var(--space-sm)" }}>
          ═══ Case File ═══
        </div>
        <h1 style={{ fontSize: "3.5rem", color: "var(--accent-gold)", marginBottom: "var(--space-sm)", textShadow: "0 0 40px rgba(212, 168, 83, 0.2)" }}>
          Cipher Court
        </h1>
        <p style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.2rem", color: "var(--text-secondary)", maxWidth: "500px" }}>
          Every clue points at a person. Every person has a story.<br />
          Only the truth survives the court.
        </p>
      </div>

      <div style={{ marginTop: "var(--space-xl)" }}>
        <button
          className="btn btn-primary"
          onClick={handleNewCase}
          disabled={loading}
          style={{ fontSize: "1rem", padding: "0.9rem 2.5rem" }}
        >
          {loading ? (
            <>
              <span className="loading-spinner" /> Opening Case File…
            </>
          ) : (
            "⟐ New Case"
          )}
        </button>
      </div>

      {error && (
        <div className="error-msg" style={{ marginTop: "var(--space-lg)", maxWidth: "400px" }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: "var(--space-3xl)", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.1em" }}>
        AI-NATIVE DETECTIVE DEDUCTION GAME • PHASE 1
      </div>
    </div>
  );
}
