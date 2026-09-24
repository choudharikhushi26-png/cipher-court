import { useState } from "react";
import { useGameState, useGameDispatch } from "../state/gameStateStore.js";
import { askSuspect } from "../lib/apiClient.js";
import SuspectCard from "../components/SuspectCard.jsx";

export default function Interrogation() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const suspect = state.knownSuspects.find((s) => s.id === selectedSuspect);

  // Filter history for selected suspect
  const suspectHistory = selectedSuspect
    ? state.interrogationHistory.filter((h) => h.suspectId === selectedSuspect)
    : [];

  async function handleAsk() {
    if (!selectedSuspect || !question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await askSuspect(state.caseId, selectedSuspect, question.trim());
      dispatch({
        type: "INTERROGATION_RESULT",
        payload: data,
        suspectId: selectedSuspect,
        question: question.trim(),
      });
      setQuestion("");
    } catch (err) {
      if (err.data?.error === "question_budget_exhausted") {
        setError("You've used all your questions. Proceed to build your case.");
      } else {
        setError(err.message || "Failed to interrogate suspect");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  return (
    <div className="screen" style={{ maxWidth: "1000px" }}>
      <div className="case-file-header">
        <div className="label">Interrogation Room</div>
        <h1>Question the Suspects</h1>
        <div className="subtitle">
          Questions remaining: <strong style={{ color: "var(--accent-gold)" }}>{state.questionBudget}</strong>
        </div>
      </div>

      {/* Suspect selection */}
      <div className="section-title">Select a Suspect to Question</div>
      <div className="grid-3" style={{ marginBottom: "var(--space-xl)" }}>
        {state.knownSuspects.map((s) => (
          <SuspectCard
            key={s.id}
            suspect={s}
            compact
            selected={selectedSuspect === s.id}
            onClick={() => {
              setSelectedSuspect(s.id);
              setError(null);
            }}
          />
        ))}
      </div>

      {/* Chat area */}
      {selectedSuspect && suspect && (
        <div className="card" style={{ padding: "var(--space-xl)", marginBottom: "var(--space-xl)" }}>
          <h3 style={{ marginBottom: "var(--space-lg)" }}>
            Questioning <span style={{ color: "var(--accent-gold)" }}>{suspect.name}</span>
          </h3>

          {/* History */}
          <div className="flex-col" style={{ gap: "var(--space-md)", marginBottom: "var(--space-lg)", maxHeight: "400px", overflowY: "auto" }}>
            {suspectHistory.length === 0 && (
              <div className="empty-state" style={{ padding: "var(--space-lg)" }}>
                Ask {suspect.name} a question about the case. Try asking about times, locations, people, or events.
              </div>
            )}
            {suspectHistory.map((entry, i) => (
              <div key={i} className="flex-col" style={{ gap: "var(--space-sm)" }}>
                <div className="chat-bubble player">
                  <div className="speaker">You</div>
                  <div>{entry.question}</div>
                </div>
                <div className="chat-bubble suspect">
                  <div className="speaker">{suspect.name}</div>
                  <div style={{ fontStyle: "italic" }}>{entry.reply}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Question input */}
          {state.questionBudget > 0 ? (
            <div style={{ display: "flex", gap: "var(--space-sm)" }}>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${suspect.name} a question…`}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleAsk}
                disabled={loading || !question.trim()}
              >
                {loading ? <span className="loading-spinner" /> : "Ask"}
              </button>
            </div>
          ) : (
            <div className="error-msg">
              Question budget exhausted. Proceed to build your case.
            </div>
          )}

          {error && <div className="error-msg" style={{ marginTop: "var(--space-sm)" }}>{error}</div>}
        </div>
      )}

      {/* Full interrogation history */}
      {state.interrogationHistory.length > 0 && (
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <div className="section-title">Complete Interrogation Log ({state.interrogationHistory.length})</div>
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {state.interrogationHistory.map((entry, i) => {
              const s = state.knownSuspects.find((x) => x.id === entry.suspectId);
              return (
                <div key={i} className="card" style={{ padding: "var(--space-md)" }}>
                  <div style={{ display: "flex", gap: "var(--space-md)", alignItems: "baseline" }}>
                    <strong style={{ color: "var(--accent-gold)", fontFamily: "var(--font-display)" }}>
                      {s?.name || entry.suspectId}
                    </strong>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                      Q: "{entry.question}"
                    </span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontStyle: "italic", marginTop: "var(--space-xs)", paddingLeft: "var(--space-md)", borderLeft: "2px solid var(--border-subtle)" }}>
                    {entry.reply}
                  </div>
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
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "investigation" })}>
          Investigation
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
