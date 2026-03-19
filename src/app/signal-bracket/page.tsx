import Link from "next/link";

import { SiteShell } from "@/components/site-shell";
import { SignalList } from "@/components/signal-list";
import { StatPill } from "@/components/stat-pill";
import { finalFourSlots, regionBrackets } from "@/lib/2026-bracket";
import { getAnalogGames, getBracketSignalProjection } from "@/lib/data";
import { percent } from "@/lib/format";
import { BracketSlot, ProjectedBracketGame, TeamSeed } from "@/lib/types";

const roundSections = [
  { round: 1, label: "Round of 64" },
  { round: 2, label: "Round of 32" },
  { round: 3, label: "Sweet 16" },
  { round: 4, label: "Elite Eight" },
  { round: 5, label: "Final Four" },
  { round: 6, label: "National Championship" },
];

function ProjectedSlotCard({
  slot,
  game,
}: {
  slot: BracketSlot;
  game: ProjectedBracketGame | undefined;
}) {
  if (!game) {
    return (
      <article className="slot-card slot-card--pending">
        <p>{slot.label}</p>
        <strong>Projection unavailable</strong>
      </article>
    );
  }

  const teams: TeamSeed[] = [game.topTeam, game.bottomTeam];

  return (
    <a href={`#explain-${slot.id}`} className="slot-card slot-card--interactive projection-slot-card">
      <p className="panel__kicker">
        {slot.region} · {slot.label}
      </p>
      <small className="slot-card__hint">
        {game.projectedWinner.name} advances with a {percent(game.projectedWinnerProbability)} projection.
      </small>
      {teams.map((team) => (
        <div
          key={`${slot.id}-${team.name}`}
          className={`team-option ${game.projectedWinner.name === team.name ? "team-option--selected" : ""}`}
        >
          <span>
            {team.seed}. {team.name}
          </span>
          <small>
            {team.conference} · {team.record}
          </small>
        </div>
      ))}
    </a>
  );
}

export default function SignalBracketPage() {
  const baselineProjection = getBracketSignalProjection("baseline");
  const projection = getBracketSignalProjection("v2");
  const gameBySlotId = new Map(projection.games.map((game) => [game.slotId, game]));
  const upsetPickCount = projection.games.filter((game) => game.upsetPick).length;
  const round64Picks = projection.games.filter((game) => game.roundNumber === 1);
  const baselineRound64Upsets = baselineProjection.games.filter((game) => game.roundNumber === 1 && game.upsetPick).length;
  const baselineUpsets = baselineProjection.games.filter((game) => game.upsetPick).length;

  return (
    <SiteShell eyebrow="Bracket Signal Projection" title="Our fully projected 2026 bracket, with the case for every pick.">
      <section className="hero-grid">
        <article className="panel stack-md">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Auto-filled bracket · v2 upset-aware pass</p>
              <h2>{projection.champion ? `${projection.champion.name} wins the title` : "Projection in progress"}</h2>
            </div>
            {projection.champion ? <span className="badge">{projection.champion.seed} seed champion</span> : null}
          </div>
          <p className="page-lede">
            This page takes Bracket Signal’s own model, corrects the resolved 2026 field, runs a second upset-aware
            pass, and attaches the same quantitative and qualitative evidence stack to every projected game.
          </p>
          <div className="stat-grid">
            <StatPill label="Games projected" value={String(projection.games.length)} />
            <StatPill label="Round of 64 upset picks" value={String(round64Picks.filter((game) => game.upsetPick).length)} tone="alert" />
            <StatPill label="Total upset picks" value={String(upsetPickCount)} tone="alert" />
            <StatPill label="Baseline round of 64 upsets" value={String(baselineRound64Upsets)} />
            <StatPill label="Baseline total upsets" value={String(baselineUpsets)} />
            <StatPill
              label="Median confidence"
              value={percent(
                projection.games
                  .map((game) => game.confidence)
                  .sort((left, right) => left - right)[Math.floor(projection.games.length / 2)] ?? 0,
              )}
            />
          </div>
          <div className="chip-row">
            <Link href="/bracket" className="primary-button">
              Compare against your bracket
            </Link>
            <Link href="/tournament-2026" className="text-link">
              Read individual 2026 matchup pages
            </Link>
          </div>
        </article>

        <aside className="panel stack-md">
          <div>
            <p className="panel__kicker">How to use it</p>
            <h2>Board first, rationale underneath.</h2>
          </div>
          <p className="muted">
            The top of the page shows the full bracket as Bracket Signal fills it out. Every board cell links straight
            to its explanation card, where the projection breaks down win probability, current-season stat edges,
            historical analogs, and qualitative notes.
          </p>
          <div className="chip-row">
            {roundSections.map((section) => (
              <a key={section.round} href={`#round-${section.round}`} className="chip">
                {section.label}
              </a>
            ))}
          </div>
        </aside>
      </section>

      <section className="stack-lg">
        {regionBrackets.map((region) => (
          <section key={region.region} className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__kicker">Projected region</p>
                <h2>{region.region}</h2>
              </div>
            </div>
            <div className="round-columns">
              {[1, 2, 3, 4].map((round) => (
                <div key={`${region.region}-${round}`} className="round-column">
                  <p className="round-column__label">{roundSections.find((section) => section.round === round)?.label}</p>
                  {region.slots
                    .filter((slot) => slot.round === round)
                    .map((slot) => (
                      <ProjectedSlotCard key={slot.id} slot={slot} game={gameBySlotId.get(slot.id)} />
                    ))}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Projected finish</p>
              <h2>Final Four and title path</h2>
            </div>
          </div>
          <div className="round-columns round-columns--final">
            {finalFourSlots.map((slot) => (
              <ProjectedSlotCard key={slot.id} slot={slot} game={gameBySlotId.get(slot.id)} />
            ))}
          </div>
        </section>
      </section>

      <section className="stack-lg">
        {roundSections.map((section) => {
          const games = projection.games.filter((game) => game.roundNumber === section.round);
          return (
            <section key={section.round} id={`round-${section.round}`} className="stack-lg">
              <div className="panel__header">
                <div>
                  <p className="panel__kicker">Why each pick landed</p>
                  <h2>{section.label}</h2>
                </div>
              </div>
              <div className="stack-lg">
                {games.map((game) => {
                  const analogs = getAnalogGames(game);
                  return (
                    <article key={game.slotId} id={`explain-${game.slotId}`} className="panel stack-md projection-card">
                      <div className="panel__header">
                        <div>
                          <p className="panel__kicker">
                            {game.region} · {game.round}
                          </p>
                          <h2>
                            {game.projectedWinner.name} over {game.projectedLoser.name}
                          </h2>
                        </div>
                        <span className={`badge ${game.upsetPick ? "badge--alert" : ""}`}>
                          {game.upsetPick ? "Upset pick" : "Favorite pick"}
                        </span>
                      </div>
                      <p className="page-lede">{game.summary}</p>
                      <div className="stat-grid">
                        <StatPill label="Projected win probability" value={percent(game.projectedWinnerProbability)} tone="favorite" />
                        <StatPill label="Upset likelihood" value={percent(game.upsetLikelihood)} tone="alert" />
                        <StatPill label="Volatility" value={percent(game.volatility)} />
                        <StatPill label="Confidence" value={percent(game.confidence)} />
                      </div>
                      <div className="chip-row">
                        {game.tags.map((tag) => (
                          <span key={`${game.slotId}-${tag.label}`} className={`chip chip--${tag.tone}`}>
                            {tag.label}
                          </span>
                        ))}
                        {game.roundNumber === 1 ? (
                          <Link href={`/tournament-2026/${game.slotId}`} className="text-link">
                            Open dedicated matchup page
                          </Link>
                        ) : null}
                      </div>

                      <details className="projection-details" open={game.roundNumber >= 5}>
                        <summary>Open full explanation</summary>
                        <div className="stack-lg projection-details__body">
                          <section className="detail-grid">
                            <article className="panel stack-sm">
                              <p className="panel__kicker">Quantitative case</p>
                              <p className="muted">{game.favoriteCaseSummary}</p>
                              <div className="comparison-table">
                                <div className="comparison-table__header">
                                  <span>{game.favoriteTeam}</span>
                                  <span>{game.statComparisonRows.length > 0 ? "Current-season metric" : "Bracket baseline"}</span>
                                  <span>{game.underdogTeam}</span>
                                </div>
                                {(game.statComparisonRows.length > 0 ? game.statComparisonRows : game.comparisonRows).map((row) => (
                                  <article key={`${game.slotId}-${row.label}`} className={`comparison-row comparison-row--${row.lean}`}>
                                    <strong>{row.favoriteValue}</strong>
                                    <div>
                                      <span>{row.label}</span>
                                      <small>{row.rationale}</small>
                                    </div>
                                    <strong>{row.underdogValue}</strong>
                                  </article>
                                ))}
                              </div>
                            </article>

                            <article className="panel stack-sm">
                              <p className="panel__kicker">Qualitative case</p>
                              <p className="muted">{game.underdogCaseSummary}</p>
                              {game.editorialNotes.map((note) => (
                                <div key={`${game.slotId}-${note.tag}-${note.summary}`} className="insight-note">
                                  <strong>{note.tag}</strong>
                                  <small>{note.summary}</small>
                                </div>
                              ))}
                            </article>
                          </section>

                          <section className="detail-grid">
                            <SignalList title="Why the pick won the model" signals={game.topSignals} />
                            <SignalList title="Why the other side stayed live" signals={game.upsetSignals} />
                          </section>

                          <section className="detail-grid">
                            {game.analysisSections.map((analysis) => (
                              <article key={`${game.slotId}-${analysis.title}`} className="panel stack-sm">
                                <p className="panel__kicker">{analysis.title}</p>
                                <p className="muted">{analysis.summary}</p>
                                <div className="signal-list">
                                  {analysis.highlights.map((highlight) => (
                                    <div key={`${game.slotId}-${analysis.title}-${highlight}`} className="signal-list__item">
                                      <span className="signal-list__label">{highlight}</span>
                                    </div>
                                  ))}
                                </div>
                              </article>
                            ))}
                          </section>

                          <section className="detail-grid">
                            <article className="panel stack-sm">
                              <p className="panel__kicker">Quantitative highlights</p>
                              <div className="signal-list">
                                {game.quantitativeHighlights.map((highlight) => (
                                  <div key={`${game.slotId}-quant-${highlight}`} className="signal-list__item">
                                    <span className="signal-list__label">{highlight}</span>
                                  </div>
                                ))}
                              </div>
                            </article>
                            <article className="panel stack-sm">
                              <p className="panel__kicker">Historical analogs</p>
                              {analogs.length > 0 ? (
                                analogs.map((analog) => (
                                  <Link key={analog.gameId} href={`/historical/${analog.gameId}`} className="watchlist-card">
                                    <div>
                                      <strong>
                                        {analog.season} · {analog.underdog} over {analog.favorite}
                                      </strong>
                                      <small>{analog.templateExplanation}</small>
                                    </div>
                                  </Link>
                                ))
                              ) : (
                                <p className="muted">No historical analogs were attached to this projected game.</p>
                              )}
                            </article>
                          </section>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>
    </SiteShell>
  );
}
