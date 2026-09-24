import { useState } from "react";
import { useGameState, useGameDispatch } from "../state/gameStateStore.js";
import { investigate } from "../lib/apiClient.js";
import EvidenceCard from "../components/EvidenceCard.jsx";

export default function Investigation() {
  const state = useGameState();
  const dispatch = useGameDispatch();
  const [searchingLoc, setSearchingLoc] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  // Track which locations have been investigated
  const investigatedLocs = new Set();
  for (const ev of state.discoveredEvidence) {
    if (ev.location_id) investigatedLocs.add(ev.location_id);
  }
  for (const evt of state.discoveredEvents) {
    if (evt.location_id) investigatedLocs.add(evt.location_id);
  }

  async function handleSearch(locationId) {
    setSearchingLoc(locationId);
    setError(null);
    setLastResult(null);
    try {
      const data = await investigate(state.caseId, locationId);
      dispatch({ type: "INVESTIGATION_RESULT", payload: data });
      setLastResult({
        locationId,
        evidence: data.newlyDiscoveredEvidence || [],
        events: data.newlyDiscoveredEvents || [],
      });
    } catch (err) {
      setError(err.message || "Investigation failed");
    } finally {
      setSearchingLoc(null);
    }
  }

  return (
    <div className="screen">
      <div className="case-file-header">
        <div className="label">Investigation Phase</div>
        <h1>Search the Scene</h1>
        <div className="subtitle">Select a location to search for evidence and events</div>
      </div>

      {/* Locations */}
      <div className="section-title">Locations</div>
      <div className="grid-3" style={{ marginBottom: "var(--space-xl)" }}>
        {state.locations.map((loc) => {
          const wasSearched = investigatedLocs.has(loc.id);
          const isSearching = searchingLoc === loc.id;
          return (
            <div
              key={loc.id}
              className={`location-card${wasSearched ? " investigated" : ""}`}
              onClick={() => !isSearching && handleSearch(loc.id)}
            >
              <div className="location-name">{loc.name}</div>
              <div className="location-desc">{loc.description}</div>
              {isSearching && (
                <div style={{ marginTop: "var(--space-sm)", display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                  <span className="loading-spinner" />
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Searching…</span>
                </div>
              )}
              {wasSearched && !isSearching && (
                <div style={{ marginTop: "var(--space-sm)", fontSize: "0.78rem", color: "var(--accent-gold-dim)" }}>
                  ✓ Searched
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Last search result */}
      {lastResult && (
        <div style={{ marginBottom: "var(--space-xl)", animation: "fadeIn 0.4s ease" }}>
          <div className="section-title">
            Search Results — {state.locations.find((l) => l.id === lastResult.locationId)?.name}
          </div>
          {lastResult.evidence.length === 0 && lastResult.events.length === 0 ? (
            <div className="empty-state">Nothing new found here.</div>
          ) : (
            <div className="flex-col">
              {lastResult.events.map((evt) => (
                <div key={evt.id} className="timeline-item">
                  <span className="time">{evt.time}</span>
                  <span className="event-desc">{evt.description}</span>
                </div>
              ))}
              {lastResult.evidence.map((ev) => (
                <EvidenceCard key={ev.id} evidence={ev} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All discovered evidence summary */}
      {state.discoveredEvidence.length > 0 && (
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <div className="section-title">All Discovered Evidence ({state.discoveredEvidence.length})</div>
          <div className="flex-col">
            {state.discoveredEvidence.map((ev) => (
              <EvidenceCard key={ev.id} evidence={ev} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {state.discoveredEvents.length > 0 && (
        <div style={{ marginBottom: "var(--space-xl)" }}>
          <div className="section-title">Timeline ({state.discoveredEvents.length})</div>
          <div className="flex-col" style={{ gap: 0 }}>
            {[...state.discoveredEvents]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((evt) => (
                <div key={evt.id} className="timeline-item">
                  <span className="time">{evt.time}</span>
                  <span className="event-desc">{evt.description}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", marginTop: "var(--space-2xl)" }}>
        <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "briefing" })}>
          ← Briefing
        </button>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "evidenceBoard" })}
          disabled={state.discoveredEvidence.length === 0}
        >
          Evidence Board →
        </button>
      </div>
    </div>
  );
}
