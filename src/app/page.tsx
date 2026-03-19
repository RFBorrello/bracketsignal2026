import Link from "next/link";

import { CandidateCard } from "@/components/candidate-card";
import { SiteShell } from "@/components/site-shell";
import { StatPill } from "@/components/stat-pill";
import { getDataset, getTopUpsetCandidates } from "@/lib/data";
import { percent } from "@/lib/format";

export default function HomePage() {
  const dataset = getDataset();
  const candidates = getTopUpsetCandidates().slice(0, 4);

  return (
    <SiteShell eyebrow="Men's NCAA Tournament Intelligence" title="Build a sharper bracket, not a luckier one.">
      <section className="hero-grid">
        <article className="hero-marquee">
          <div className="hero-marquee__grid">
            <div className="stack-lg">
              <p className="page-lede">
                This site blends historical upset analysis, matchup-level signal breakdowns, and a live 2026 bracket
                workflow built for the actual field released on March 15, 2026.
              </p>
              <div className="stat-grid">
                <StatPill label="Historical games loaded" value={dataset.summary.games.toLocaleString()} />
                <StatPill label="Seed upsets tagged" value={dataset.summary.upsets.toLocaleString()} tone="alert" />
                <StatPill
                  label="Latest season in corpus"
                  value={String(dataset.summary.latestSeason)}
                  tone="favorite"
                />
              </div>
              <div className="chip-row">
                <Link href="/bracket" className="primary-button">
                  Open bracket builder
                </Link>
                <Link href="/signal-bracket" className="text-link">
                  View Signal Bracket
                </Link>
                <Link href="/historical" className="text-link">
                  Explore historical games
                </Link>
              </div>
            </div>
            <div className="hero-marquee__rail">
              {candidates.slice(0, 3).map((candidate) => (
                <div key={candidate.id} className="marquee-card">
                  <p className="panel__kicker">{candidate.region} upset watch</p>
                  <strong>
                    {candidate.underdogTeam} over {candidate.favoriteTeam}
                  </strong>
                  <p>{candidate.summary}</p>
                  <span>{percent(candidate.upsetLikelihood)} upset likelihood</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <aside className="panel stack-md">
          <div>
            <p className="panel__kicker">What this does</p>
            <h2>Quant first, narrative when the numbers fail.</h2>
          </div>
          <p className="muted">
            Every game gets structured pregame signals, model framing, and qualitative context. Historical upsets and
            2026 matchup pages now run through the same analog-driven analysis stack, including favorite cases,
            underdog cases, and “what the model missed” notes.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Historical explorer</td>
                <td>Find seed traps, analogs, and favorite survivals across the full public corpus.</td>
              </tr>
              <tr>
                <td>2026 hub</td>
                <td>Read generated matchup pages for every first-round game in the live field.</td>
              </tr>
              <tr>
                <td>Bracket builder</td>
                <td>Make picks with analysis pinned alongside the board.</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </section>

      <section className="stack-lg">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">2026 watchboard</p>
            <h2>Top upset candidates right now</h2>
          </div>
          <Link href="/tournament-2026" className="text-link">
            Full 2026 hub
          </Link>
        </div>
        <div className="card-grid">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} preview={candidate} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
