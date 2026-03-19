import Link from "next/link";

import { percent } from "@/lib/format";
import { MatchupPreview } from "@/lib/types";
import { StatPill } from "@/components/stat-pill";

export function CandidateCard({ preview }: { preview: MatchupPreview }) {
  return (
    <article className="panel candidate-card">
      <div className="candidate-card__head">
        <div>
          <p className="panel__kicker">
            {preview.region} · {preview.round}
          </p>
          <h3>
            {preview.bottomTeam.seed}-{preview.topTeam.seed} {preview.underdogTeam} over {preview.favoriteTeam}?
          </h3>
        </div>
        <div className="chip-row">
          {preview.tags.map((tag) => (
            <span key={tag.label} className={`chip chip--${tag.tone}`}>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
      <p>{preview.summary}</p>
      <div className="stat-grid">
        <StatPill label="Favorite win" value={percent(preview.favoriteWinProbability)} tone="favorite" />
        <StatPill label="Upset likelihood" value={percent(preview.upsetLikelihood)} tone="alert" />
        <StatPill label="Volatility" value={percent(preview.volatility)} />
        <StatPill label="Analog sample" value={String(preview.historicalSampleSize)} />
      </div>
      <Link href={`/tournament-2026/${preview.id}`} className="text-link">
        Read matchup page
      </Link>
    </article>
  );
}
