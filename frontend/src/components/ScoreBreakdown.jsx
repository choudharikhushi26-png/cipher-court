export default function ScoreBreakdown({ verdictResult, knownSuspects, discoveredEvidence }) {
  if (!verdictResult) return null;

  const {
    correct_culprit,
    motive_correct,
    method_correct,
    score,
    claims_scored,
  } = verdictResult;

  // Helper to find name by id
  const suspectName = (id) => knownSuspects?.find((s) => s.id === id)?.name || id;
  const evidenceDesc = (id) => {
    const ev = discoveredEvidence?.find((e) => e.id === id);
    return ev ? ev.description.slice(0, 60) + (ev.description.length > 60 ? "…" : "") : id;
  };

  return (
    <div className="flex-col" style={{ gap: "var(--space-lg)" }}>
      {/* Score */}
      <div className="score-display">
        <div className="score-number">{score}</div>
        <div className="score-label">Final Score / 100</div>
      </div>

      {/* Top-level results */}
      <div className="grid-3" style={{ textAlign: "center" }}>
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ fontSize: "1.5rem" }}>{correct_culprit ? "✓" : "✗"}</div>
          <div className={correct_culprit ? "result-correct" : "result-incorrect"} style={{ fontWeight: 600 }}>
            Culprit {correct_culprit ? "+50" : "+0"}
          </div>
        </div>
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ fontSize: "1.5rem" }}>{motive_correct ? "✓" : "✗"}</div>
          <div className={motive_correct ? "result-correct" : "result-incorrect"} style={{ fontWeight: 600 }}>
            Motive {motive_correct ? "+10" : "+0"}
          </div>
        </div>
        <div className="card" style={{ padding: "var(--space-md)" }}>
          <div style={{ fontSize: "1.5rem" }}>{method_correct ? "✓" : "✗"}</div>
          <div className={method_correct ? "result-correct" : "result-incorrect"} style={{ fontWeight: 600 }}>
            Method {method_correct ? "+10" : "+0"}
          </div>
        </div>
      </div>

      {/* Per-claim results */}
      <div>
        <div className="section-title">Evidence Claims Breakdown</div>
        {claims_scored && claims_scored.length > 0 ? (
          <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
            {claims_scored.map((cs, i) => {
              const claim = cs.claim;
              const suspId = claim.suspect_id || claim.target_suspect_id;
              return (
                <div key={i} className="claim-row">
                  <span style={{ fontSize: "1.2rem", marginRight: "var(--space-sm)" }}>
                    {cs.result === "correct" ? "✓" : cs.result === "partial" ? "◐" : "✗"}
                  </span>
                  <span className="claim-evidence">{evidenceDesc(claim.evidence_id)}</span>
                  <span className="claim-arrow">→</span>
                  <span className={`claim-badge ${claim.claim_type}`}>
                    {claim.claim_type.replace(/_/g, " ")}
                  </span>
                  <span className="claim-arrow">→</span>
                  <span className="claim-suspect">{suspectName(suspId)}</span>
                  <span
                    className={`result-${cs.result}`}
                    style={{ marginLeft: "auto", fontWeight: 600, fontSize: "0.82rem", textTransform: "uppercase" }}
                  >
                    {cs.result}
                    {cs.result === "partial" && cs.groundTruthClaimType && (
                      <span style={{ fontWeight: 400, opacity: 0.7 }}>
                        {" "}(was {cs.groundTruthClaimType.replace(/_/g, " ")})
                      </span>
                    )}
                    {cs.reason && (
                      <span style={{ fontWeight: 400, opacity: 0.7 }}>
                        {" "}({cs.reason.replace(/_/g, " ")})
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">No claims submitted</div>
        )}
      </div>
    </div>
  );
}
