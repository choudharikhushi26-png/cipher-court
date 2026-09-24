export default function SuspectCard({ suspect, selected, onClick, compact }) {
  return (
    <div
      className={`suspect-card${selected ? " selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="suspect-name">{suspect.name}</div>
      <div className="suspect-role">{suspect.relationship_to_victim}</div>
      {!compact && suspect.alibi_claim && (
        <div className="suspect-alibi">"{suspect.alibi_claim}"</div>
      )}
    </div>
  );
}
