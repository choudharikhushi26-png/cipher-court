export default function EvidenceCard({ evidence, selected, onClick }) {
  return (
    <div
      className={`evidence-card${selected ? " selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <span className="tag">{evidence.id}</span>
      <p>{evidence.description}</p>
    </div>
  );
}
