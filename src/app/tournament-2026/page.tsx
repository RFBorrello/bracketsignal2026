import { CandidateCard } from "@/components/candidate-card";
import { SiteShell } from "@/components/site-shell";
import { regionBrackets } from "@/lib/2026-bracket";
import { getTopUpsetCandidates, getTournament2026Matchups } from "@/lib/data";
import { percent } from "@/lib/format";

export default function TournamentHubPage() {
  const candidates = getTopUpsetCandidates();
  const matchups = getTournament2026Matchups();

  return (
    <SiteShell eyebrow="2026 Tournament Hub" title="Live first-round danger spots across the field.">
      <section className="overview-grid">
        {regionBrackets.map((region) => (
          <article key={region.region} className="panel">
            <p className="panel__kicker">{region.region} region</p>
            <h2>{region.slots.filter((slot) => slot.round === 1).length} first-round games</h2>
            <p className="muted">
              Includes the live field released on Sunday, March 15, 2026, with the First Four results resolved as of
              Thursday, March 19, 2026.
            </p>
          </article>
        ))}
      </section>

      <section className="panel stack-md">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Generated matchup layer</p>
            <h2>Every Round of 64 game now carries the historical-style analysis stack.</h2>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat-pill">
            <span>First-round matchups</span>
            <strong>{matchups.length}</strong>
          </div>
          <div className="stat-pill stat-pill--alert">
            <span>Flagged upset candidates</span>
            <strong>{candidates.length}</strong>
          </div>
          <div className="stat-pill">
            <span>Median upset likelihood</span>
            <strong>{percent(matchups[Math.floor(matchups.length / 2)]?.upsetLikelihood ?? 0)}</strong>
          </div>
        </div>
      </section>

      <section className="stack-lg">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Highlighted pages</p>
            <h2>Detailed upset candidate breakdowns</h2>
          </div>
        </div>
        <div className="card-grid">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} preview={candidate} />
          ))}
        </div>
      </section>

      <section className="stack-lg">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Full first round</p>
            <h2>Every 2026 opening matchup</h2>
          </div>
        </div>
        <div className="card-grid">
          {matchups.map((matchup) => (
            <CandidateCard key={matchup.id} preview={matchup} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
