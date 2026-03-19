import { Signal } from "@/lib/types";

export function SignalList({
  title,
  signals,
}: {
  title: string;
  signals: Signal[];
}) {
  return (
    <section className="panel">
      <p className="panel__kicker">{title}</p>
      {signals.length > 0 ? (
        <div className="signal-list">
          {signals.map((signal) => (
            <article key={`${signal.label}-${signal.value}`} className="signal-card">
              <div className="signal-card__header">
                <h3>{signal.label}</h3>
                <span>{signal.value}</span>
              </div>
              <div className="signal-strength">
                <div style={{ width: `${Math.round(signal.strength * 100)}%` }} />
              </div>
              <p>{signal.detail}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No structured signals were attached to this record yet.</p>
      )}
    </section>
  );
}
