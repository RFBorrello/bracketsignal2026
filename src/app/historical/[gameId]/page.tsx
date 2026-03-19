import Link from "next/link";
import { notFound } from "next/navigation";

import { SignalList } from "@/components/signal-list";
import { SiteShell } from "@/components/site-shell";
import { StatPill } from "@/components/stat-pill";
import { getGame, getHistoricalGameAnalysis } from "@/lib/data";
import { percent } from "@/lib/format";

export default async function HistoricalDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = getGame(gameId);

  if (!game) {
    notFound();
  }
  const resolvedGame = game;
  const analysis = getHistoricalGameAnalysis(resolvedGame);

  return (
    <SiteShell
      eyebrow={`${resolvedGame.season} · ${resolvedGame.round}`}
      title={`${resolvedGame.underdog} vs ${resolvedGame.favorite}`}
    >
      <section className="detail-grid">
        <article className="panel stack-lg">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">{resolvedGame.seedUpset ? "Upset breakdown" : "Favorite survival"}</p>
              <h2>
                {resolvedGame.winner} {resolvedGame.winnerScore}, {resolvedGame.loser} {resolvedGame.loserScore}
              </h2>
            </div>
            <div className="chip-row">
              <span className={`badge ${resolvedGame.seedUpset ? "badge--alert" : ""}`}>
                {resolvedGame.seedUpset ? "Seed upset" : "Favorite held"}
              </span>
              {resolvedGame.modelUpset ? <span className="chip chip--favorite">Model upset</span> : null}
              {resolvedGame.marketUpset === null ? <span className="chip">Market N/A</span> : null}
            </div>
          </div>
          <p className="page-lede">{analysis.summary}</p>
          <div className="stat-grid">
            <StatPill label="Favorite win prob." value={percent(resolvedGame.favoriteWinProbability)} />
            <StatPill label="Upset likelihood" value={percent(resolvedGame.upsetLikelihood)} tone="alert" />
            <StatPill label="Volatility" value={percent(resolvedGame.volatility)} />
            <StatPill label="Confidence" value={percent(resolvedGame.confidence)} tone="favorite" />
            <StatPill label="Notes" value={String(analysis.noteCount)} />
            <StatPill label="Sources" value={String(analysis.sourceCount)} />
          </div>
          <div className="analysis-grid">
            {analysis.sections.slice(0, 2).map((section) => (
              <article
                key={section.title}
                className={`analysis-card analysis-card--${section.tone ?? "neutral"}`}
              >
                <p className="panel__kicker">{section.title}</p>
                <p>{section.summary}</p>
                {section.highlights.length > 0 ? (
                  <ul>
                    {section.highlights.slice(0, 4).map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </article>

        <aside className="stack-lg">
          <SignalList title="Favorite indicators" signals={resolvedGame.topSignals} />
          <SignalList title="Underdog signals" signals={resolvedGame.upsetSignals} />
          <article className="panel stack-sm">
            <p className="panel__kicker">Qualitative notes</p>
            {resolvedGame.editorialNotes.length > 0 ? (
              <div className="note-list">
                {resolvedGame.editorialNotes.map((note) => (
                  <article key={`${note.tag}-${note.summary}`} className="note-item">
                    <div className="panel__header">
                      <h3>{note.tag}</h3>
                      <span className="chip">{percent(note.confidence)} confidence</span>
                    </div>
                    <p>{note.summary}</p>
                    <div className="chip-row">
                      {note.sources.map((source) => (
                        <span key={source.label} className="chip">
                          {source.label}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No bespoke notes attached yet; this page is currently using the templated analysis path.</p>
            )}
          </article>
        </aside>
      </section>

      <section className="detail-grid">
        <article className="panel stack-md">
          <p className="panel__kicker">Historical analogs</p>
          {analysis.analogs.length > 0 ? (
            <div className="analog-list">
              {analysis.analogs.map((analog) => (
                <Link key={analog.gameId} href={`/historical/${analog.gameId}`} className="analog-card">
                  <div>
                    <strong>
                      {analog.season} · {analog.round} · {analog.underdog} over {analog.favorite}
                    </strong>
                    <small>{analog.templateExplanation}</small>
                  </div>
                  <span className="badge">{analog.seedGap}-seed gap</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted">No prior analogs were attached for this record.</p>
          )}
        </article>

        <article className="panel stack-md">
          <p className="panel__kicker">Analysis notes</p>
          <p className="muted">{analysis.favoriteSummary}</p>
          <p className="muted">{analysis.upsetSummary}</p>
          <div className="stack-sm">
            {analysis.sections.slice(2).map((section) => (
              <article key={section.title} className="analysis-card analysis-card--neutral">
                <p className="panel__kicker">{section.title}</p>
                <p>{section.summary}</p>
                {section.highlights.length > 0 ? (
                  <ul>
                    {section.highlights.slice(0, 4).map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="panel stack-md">
        <p className="panel__kicker">Source trail</p>
        <div className="analysis-meta">
          {resolvedGame.sourceProvenance.map((source) => (
            <Link key={source.url} href={source.url} className="chip chip--favorite" target="_blank" rel="noreferrer">
              {source.label}
            </Link>
          ))}
        </div>
        <p className="muted">
          {analysis.noteCount} editorial note(s) and {analysis.sourceCount} unique source label(s) are currently attached
          to this game record.
        </p>
      </section>
    </SiteShell>
  );
}
