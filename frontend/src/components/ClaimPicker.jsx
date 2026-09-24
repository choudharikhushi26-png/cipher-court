const CLAIM_TYPES = [
  { value: "PLACES_AT", label: "Places At Scene", description: "This evidence places the suspect at a location or time" },
  { value: "CONTRADICTS", label: "Contradicts Alibi", description: "This evidence contradicts the suspect's alibi" },
  { value: "ESTABLISHES_MOTIVE", label: "Establishes Motive", description: "This evidence establishes a motive for the suspect" },
  { value: "ESTABLISHES_METHOD", label: "Establishes Method", description: "This evidence establishes how the crime was committed" },
  { value: "SUPPORTS_ALIBI", label: "Supports Alibi", description: "This evidence supports the suspect's alibi" },
];

export default function ClaimPicker({ selectedType, onSelect }) {
  return (
    <div className="flex-col" style={{ gap: "var(--space-sm)" }}>
      {CLAIM_TYPES.map((ct) => (
        <div
          key={ct.value}
          className={`card${selectedType === ct.value ? " card-selected" : ""}`}
          onClick={() => onSelect(ct.value)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelect(ct.value)}
          style={{ padding: "var(--space-sm) var(--space-md)", cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
            <span className={`claim-badge ${ct.value}`}>{ct.value.replace(/_/g, " ")}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{ct.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export { CLAIM_TYPES };
