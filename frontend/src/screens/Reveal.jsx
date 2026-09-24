import { useGameState, useGameDispatch } from "../state/gameStateStore.js";

export default function Reveal() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  const revealed = state.revealedCase;
  if (!revealed) {
    return (
      <div className="screen">
        <div className="empty-state">
          <p>No case reveal available.</p>
          <button className="btn" onClick={() => dispatch({ type: "NEW_GAME" })} style={{ marginTop: "var(--space-md)" }}>
            Start New Game
          </button>
        </div>
      </div>
    );
  }

  const culprit = revealed.suspects.find((s) => s.is_culprit);
  const suspectById = Object.fromEntries(revealed.suspects.map((s) => [s.id, s]));
  const evidenceById = Object.fromEntries(revealed.evidence.map((e) => [e.id, e]));

  return (
    <div className="screen" style={{ maxWidth: "1000px" }}>
      <div className="case-file-header">
        <div className="label">Case File — Declassified</div>
        <h1>The Complete Truth</h1>
        <div className="subtitle">The Death of {revealed.victim} — {revealed.setting}</div>
      </div>

      {/* The Culprit */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">The Culprit</div>
        <div className="card" style={{ padding: "var(--space-xl)", border: "1px solid var(--accent-red-dim)" }}>
          <h2 style={{ color: "var(--accent-gold)", marginBottom: "var(--space-xs)" }}>
            {culprit?.name}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
            {culprit?.relationship_to_victim}
          </p>
          {culprit?.secret && (
            <div style={{ marginTop: "var(--space-md)", padding: "var(--space-md)", background: "rgba(196, 64, 64, 0.08)", border: "1px solid rgba(196, 64, 64, 0.2)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--accent-red)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-xs)" }}>
                Hidden Secret
              </div>
              <p style={{ color: "var(--text-secondary)" }}>{culprit.secret}</p>
            </div>
          )}
        </div>
      </div>

      {/* Solution */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">The Solution</div>
        <div className="grid-2">
          <div className="card">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-xs)" }}>
              Motive
            </div>
            <p style={{ color: "var(--text-secondary)" }}>{revealed.solution.motive_text}</p>
          </div>
          <div className="card">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "var(--space-xs)" }}>
              Method
            </div>
            <p style={{ color: "var(--text-secondary)" }}>{revealed.solution.method_text}</p>
          </div>
        </div>
      </div>

      {/* All Suspects — now with secrets revealed */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">All Suspects — Secrets Revealed</div>
        <div className="flex-col">
          {revealed.suspects.map((s) => (
            <div key={s.id} className="card" style={{ padding: "var(--space-lg)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                <h3 style={{ color: s.is_culprit ? "var(--accent-red)" : "var(--text-primary)" }}>
                  {s.name}
                  {s.is_culprit && (
                    <span style={{ marginLeft: "var(--space-sm)", fontSize: "0.75rem", color: "var(--accent-red)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                      [culprit]
                    </span>
                  )}
                </h3>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {s.relationship_to_victim}
                </span>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
                <strong>Alibi:</strong> "{s.alibi_claim}"
              </p>
              {s.secret && (
                <p style={{ fontSize: "0.88rem", color: "var(--accent-gold)", fontStyle: "italic" }}>
                  Secret: {s.secret}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* All Evidence — now with red herring flags */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">All Evidence</div>
        <div className="flex-col">
          {revealed.evidence.map((ev) => (
            <div key={ev.id} className="evidence-card" style={{ cursor: "default" }}>
              <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-xs)" }}>
                <span className="tag">{ev.id}</span>
                {ev.is_red_herring && (
                  <span style={{ display: "inline-block", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--accent-red)", textTransform: "uppercase", letterSpacing: "0.1em", background: "rgba(196, 64, 64, 0.1)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                    Red Herring
                  </span>
                )}
              </div>
              <p>{ev.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ground-Truth Edges */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Ground-Truth Evidence Chain</div>
        <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
          {revealed.edges.map((edge, i) => (
            <div key={i} className="claim-row">
              {edge.is_required && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--accent-gold)", marginRight: "var(--space-sm)" }}>
                  REQ
                </span>
              )}
              <span className="claim-evidence">
                {evidenceById[edge.evidence_id]?.description?.slice(0, 50) || edge.evidence_id}…
              </span>
              <span className="claim-arrow">→</span>
              <span className={`claim-badge ${edge.claim_type}`}>
                {edge.claim_type.replace(/_/g, " ")}
              </span>
              <span className="claim-arrow">→</span>
              <span className="claim-suspect">
                {suspectById[edge.suspect_id]?.name || edge.suspect_id}
              </span>
              {edge.metadata?.note && (
                <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  {edge.metadata.note}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Full Timeline</div>
        <div className="flex-col" style={{ gap: 0 }}>
          {revealed.events.map((evt) => (
            <div key={evt.id} className="timeline-item">
              <span className="time">{evt.time}</span>
              <span className="event-desc">{evt.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* New Game */}
      <div style={{ textAlign: "center", marginTop: "var(--space-2xl)", paddingBottom: "var(--space-2xl)" }}>
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", marginBottom: "var(--space-md)", fontFamily: "var(--font-display)" }}>
          "The truth, once revealed, cannot be unseen."
        </p>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "NEW_GAME" })}
          style={{ fontSize: "1rem", padding: "0.9rem 2.5rem" }}
        >
          ⟐ New Case
        </button>
      </div>
    </div>
  );
}
