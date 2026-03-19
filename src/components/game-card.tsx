import Link from "next/link";

import { getHistoricalGameAnalysis } from "@/lib/data";
import { percent } from "@/lib/format";
import { GameRecord } from "@/lib/types";
import { StatPill } from "@/components/stat-pill";

export function GameCard({ game }: { game: GameRecord }) {
  const analysis = getHistoricalGameAnalysis(game);

  return (
    <article className="panel game-card">
      <div className="game-card__head">
        <div>
          <p className="panel__kicker">
            {game.season} · {game.round}
          </p>
          <h3>
            {game.winner} {game.winnerScore}, {game.loser} {game.loserScore}
          </h3>
          <p className="game-card__summary">{analysis.summary}</p>
        </div>
        <div className="chip-row">
          <span className={`badge ${game.seedUpset ? "badge--alert" : ""}`}>{game.seedUpset ? "Seed upset" : "Favorite held"}</span>
          {game.modelUpset ? <span className="chip chip--favorite">Model upset</span> : null}
          {game.marketUpset === null ? <span className="chip">Market N/A</span> : null}
        </div>
      </div>
      <div className="stat-grid">
        <StatPill label="Favorite win prob." value={percent(game.favoriteWinProbability)} />
        <StatPill label="Upset likelihood" value={percent(game.upsetLikelihood)} tone="alert" />
        <StatPill label="Volatility" value={percent(game.volatility)} />
        <StatPill label="Confidence" value={percent(game.confidence)} tone="favorite" />
        <StatPill label="Notes" value={String(analysis.noteCount)} />
        <StatPill label="Analogs" value={String(analysis.analogs.length)} />
      </div>
      <div className="chip-row">
        <span className="chip">Seed gap {game.seedGap}</span>
        <span className="chip">Seed line {game.favoriteSeed}-{game.underdogSeed}</span>
      </div>
      <Link href={`/historical/${game.gameId}`} className="text-link">
        Open breakdown
      </Link>
    </article>
  );
}
