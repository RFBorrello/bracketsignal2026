import Link from "next/link";

import { SiteShell } from "@/components/site-shell";
import { StatPill } from "@/components/stat-pill";
import { getHistoricalUpsets } from "@/lib/data";
import { percent } from "@/lib/format";

export default function UpsetLabPage() {
  const upsets = getHistoricalUpsets();
  const averageUpsetLikelihood =
    upsets.reduce((sum, game) => sum + game.upsetLikelihood, 0) / Math.max(upsets.length, 1);

  return (
    <SiteShell eyebrow="Upset Lab" title="Separate the chaos games from the fake chaos games.">
      <section className="overview-grid">
        <StatPill label="Seed upsets in corpus" value={String(upsets.length)} tone="alert" />
        <StatPill label="Average upset likelihood" value={percent(averageUpsetLikelihood)} />
        <StatPill label="Classic 12/5 profile" value="Tracked" tone="favorite" />
        <StatPill label="Analog search" value="Prior years only" />
      </section>

      <section className="detail-grid">
        <article className="panel stack-md">
          <p className="panel__kicker">Taxonomy</p>
          <h2>Three ways a bracket game can go off-script.</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Definition</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Seed upset</td>
                <td>Lower seed beats a higher seed.</td>
              </tr>
              <tr>
                <td>Model upset</td>
                <td>The eventual winner had sub-50% win probability in the site model.</td>
              </tr>
              <tr>
                <td>Market upset</td>
                <td>Reserved for public line data when available; schema is present even when the field is null.</td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="panel stack-md">
          <p className="panel__kicker">Interpretation</p>
          <h2>What to do with a candidate page.</h2>
          <p className="muted">
            Treat upset likelihood as a routing signal, not a permission slip. The useful games are where volatility
            and structural analogs both agree that the favorite's margin for error is narrow.
          </p>
          <Link href="/methodology" className="text-link">
            Read methodology
          </Link>
        </article>
      </section>
    </SiteShell>
  );
}
