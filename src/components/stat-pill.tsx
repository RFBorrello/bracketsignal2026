export function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "alert" | "favorite";
}) {
  return (
    <div className={`stat-pill stat-pill--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
