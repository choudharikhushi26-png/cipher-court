import { useGameState, useGameDispatch } from "../state/gameStateStore.jsx";
import SuspectCard from "../components/SuspectCard.jsx";

export default function Briefing() {
  const state = useGameState();
  const dispatch = useGameDispatch();

  return (
    <div className="screen">
      <div className="case-file-header">
        <div className="label">Case Briefing — Classified</div>
        <h1>The Death of {state.victim}</h1>
        <div className="subtitle">{state.setting}</div>
      </div>

      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Victim</div>
        <div className="card">
          <h3 style={{ color: "var(--accent-gold)" }}>{state.victim}</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
            Found dead under suspicious circumstances. Foul play is suspected.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Known Persons of Interest</div>
        <div className="flex-col">
          {state.knownSuspects.map((s) => (
            <SuspectCard key={s.id} suspect={s} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div className="section-title">Locations to Investigate</div>
        <div className="grid-3">
          {state.locations.map((loc) => (
            <div key={loc.id} className="card" style={{ textAlign: "center" }}>
              <h4>{loc.name}</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "var(--space-xs)" }}>
                {loc.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "var(--space-2xl)" }}>
        <p style={{ color: "var(--text-muted)", fontStyle: "italic", marginBottom: "var(--space-md)" }}>
          Search the locations, question the suspects, and build your case.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "investigation" })}
        >
          Begin Investigation →
        </button>
      </div>
    </div>
  );
}
