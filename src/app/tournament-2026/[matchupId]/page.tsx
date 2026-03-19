import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { SignalList } from "@/components/signal-list";
import { StatPill } from "@/components/stat-pill";
import { getAnalogGames, getTournament2026Matchup } from "@/lib/data";
import { percent } from "@/lib/format";

export default async function MatchupPage({
  params,
}: {
  params: Promise<{ matchupId: string }>;
}) {
  const { matchupId } = await params;
  const preview = getTournament2026Matchup(matchupId);

  if (!preview) {
    notFound();
  }
  const resolvedPreview = preview;

  const analogs = getAnalogGames(resolvedPreview);

  return (
    <SiteShell
      eyebrow={`${resolvedPreview.region} · ${resolvedPreview.round}`}
      title={`${resolvedPreview.underdogTeam} vs ${resolvedPreview.favoriteTeam}`}
    >
      <section className="detail-grid">
        <article className="panel stack-md">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">2026 matchup analysis</p>
              <h2>
                {resolvedPreview.bottomTeam.seed}-{resolvedPreview.topTeam.seed} path: {resolvedPreview.underdogTeam} over{" "}
                {resolvedPreview.favoriteTeam}
              </h2>
            </div>
          </div>
          <p className="page-lede">{resolvedPreview.summary}</p>
          <div className="stat-grid">
            <StatPill label="Favorite win probability" value={percent(resolvedPreview.favoriteWinProbability)} tone="favorite" />
            <StatPill label="Upset likelihood" value={percent(resolvedPreview.upsetLikelihood)} tone="alert" />
            <StatPill label="Volatility" value={percent(resolvedPreview.volatility)} />
            <StatPill label="Confidence" value={percent(resolvedPreview.confidence)} />
            <StatPill label="Historical upset rate" value={percent(resolvedPreview.historicalUpsetRate)} />
            <StatPill label="Analog sample" value={String(resolvedPreview.historicalSampleSize)} />
          </div>
          <div className="chip-row">
            {resolvedPreview.tags.map((tag) => (
              <span key={tag.label} className={`chip chip--${tag.tone}`}>
                {tag.label}
              </span>
            ))}
          </div>
          <div className="chip-row">
            <Link href="/bracket" className="primary-button">
              Use in bracket builder
            </Link>
            <Link href="/historical" className="text-link">
              Browse historical analogs
            </Link>
          </div>
        </article>
        <aside className="panel stack-md">
          <p className="panel__kicker">Analog games</p>
          {analogs.length > 0 ? (
            analogs.map((game) => (
              <Link key={game.gameId} href={`/historical/${game.gameId}`} className="watchlist-card">
                <div>
                  <strong>
                    {game.season} · {game.underdog} over {game.favorite}
                  </strong>
                  <small>{game.templateExplanation}</small>
                </div>
              </Link>
            ))
          ) : (
            <p className="muted">No analog games are linked for this preview yet.</p>
          )}
        </aside>
      </section>

      <section className="detail-grid">
        <article className="panel stack-md">
          <p className="panel__kicker">Favorite case</p>
          <h2>{resolvedPreview.favoriteTeam}</h2>
          <p className="muted">{resolvedPreview.favoriteCaseSummary}</p>
          <SignalList title="Why the favorite is favored" signals={resolvedPreview.topSignals} />
        </article>
        <article className="panel stack-md">
          <p className="panel__kicker">Underdog case</p>
          <h2>{resolvedPreview.underdogTeam}</h2>
          <p className="muted">{resolvedPreview.underdogCaseSummary}</p>
          <SignalList title="Why the underdog is live" signals={resolvedPreview.upsetSignals} />
        </article>
      </section>

      <section className="panel stack-md">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Quantitative matchup table</p>
            <h2>Current-season scoring, defense, shooting, and turnover pressure</h2>
          </div>
          {resolvedPreview.statSnapshotUpdated ? (
            <span className="badge">Live NCAA snapshot: {resolvedPreview.statSnapshotUpdated}</span>
          ) : resolvedPreview.statProfileSeason ? (
            <span className="badge">Latest full profile season: {resolvedPreview.statProfileSeason}</span>
          ) : null}
        </div>
        {resolvedPreview.statComparisonRows.length > 0 ? (
          <div className="comparison-table">
            <div className="comparison-table__header">
              <span>{resolvedPreview.favoriteTeam}</span>
              <span>Metric</span>
              <span>{resolvedPreview.underdogTeam}</span>
            </div>
            {resolvedPreview.statComparisonRows.map((row) => (
              <article key={row.label} className={`comparison-row comparison-row--${row.lean}`}>
                <strong>{row.favoriteValue}</strong>
                <div>
                  <span>{row.label}</span>
                  <small>{row.rationale}</small>
                </div>
                <strong>{row.underdogValue}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            A deeper current-season team-style profile is not available yet for this matchup in the public feed, so this page
            falls back to the seed/history model and qualitative layer.
          </p>
        )}
      </section>

      <section className="stack-lg">
        {resolvedPreview.analysisSections.map((section) => (
          <article key={section.title} className="panel stack-sm">
            <p className="panel__kicker">{section.title}</p>
            <p className="muted">{section.summary}</p>
            <div className="signal-list">
              {section.highlights.map((highlight) => (
                <div key={highlight} className="signal-list__item">
                  <span className="signal-list__label">{highlight}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="detail-grid">
        <article className="panel stack-md">
          <p className="panel__kicker">Qualitative notes</p>
          {resolvedPreview.editorialNotes.map((note) => (
            <div key={`${note.tag}-${note.summary}`} className="watchlist-card">
              <div>
                <strong>{note.tag}</strong>
                <small>{note.summary}</small>
              </div>
              <span className="badge">{percent(note.confidence)}</span>
            </div>
          ))}
        </article>
        <article className="panel stack-md">
          <p className="panel__kicker">Source trail</p>
          {resolvedPreview.sourceProvenance.map((source) => (
            <a key={source.url} href={source.url} className="watchlist-card">
              <div>
                <strong>{source.label}</strong>
                <small>{source.url}</small>
              </div>
            </a>
          ))}
        </article>
      </section>

      <SignalList
        title="What could break the projection"
        signals={[
          {
            label: "Model blind spot",
            direction: "underdog",
            value: percent(resolvedPreview.upsetLikelihood),
            strength: 0.62,
            detail: resolvedPreview.modelMissSummary ?? "The underdog case would need variance to outrun the favorite's cleaner pregame baseline.",
          },
          {
            label: "Bracket integration",
            direction: "favorite",
            value: "Live",
            strength: 0.45,
            detail: "This matchup page is wired directly into the same bracket builder you use to advance picks.",
          },
        ]}
      />
    </SiteShell>
  );
}
