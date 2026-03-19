import { FilterBar } from "@/components/filter-bar";
import { SiteShell } from "@/components/site-shell";
import { getDataset, getHistoricalGames } from "@/lib/data";
import { StatPill } from "@/components/stat-pill";
import { percent } from "@/lib/format";

export default function HistoricalPage() {
  const dataset = getDataset();
  const games = getHistoricalGames();

  return (
    <SiteShell eyebrow="Historical Explorer" title="Every upset should look obvious in retrospect.">
      <p className="page-lede">
        Filter the full public tournament corpus, jump straight into upset breakdowns, and compare how often the
        favorite profile actually held.
      </p>
      <section className="panel stack-md">
        <div className="panel__header">
          <div>
            <p className="panel__kicker">Corpus snapshot</p>
            <h2>Built to absorb deeper historical analysis fields as they land.</h2>
          </div>
          <span className="badge badge--alert">Public Kaggle data</span>
        </div>
        <div className="stat-grid">
          <StatPill label="Games loaded" value={dataset.summary.games.toLocaleString()} />
          <StatPill label="Seed upsets" value={dataset.summary.upsets.toLocaleString()} tone="alert" />
          <StatPill label="Seasons covered" value={`${Math.min(...dataset.summary.seasons)}-${Math.max(...dataset.summary.seasons)}`} />
          <StatPill label="Latest season" value={String(dataset.summary.latestSeason)} tone="favorite" />
          <StatPill label="Upset rate" value={percent(dataset.summary.upsets / dataset.summary.games)} />
        </div>
      </section>
      <FilterBar games={games} />
    </SiteShell>
  );
}
