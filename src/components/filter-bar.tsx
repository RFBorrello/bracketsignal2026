"use client";

import { useMemo, useState } from "react";

import { GameCard } from "@/components/game-card";
import { getHistoricalGameSearchText } from "@/lib/data";
import { GameRecord } from "@/lib/types";

export function FilterBar({ games }: { games: GameRecord[] }) {
  const [query, setQuery] = useState<string>("");
  const [season, setSeason] = useState<string>("all");
  const [round, setRound] = useState<string>("all");
  const [outcome, setOutcome] = useState<"all" | "upset" | "chalk">("all");
  const [confidence, setConfidence] = useState<"all" | "low" | "mid" | "high">("all");
  const [seedGap, setSeedGap] = useState<"all" | "1" | "2" | "4">("all");

  const seasons = useMemo(
    () => Array.from(new Set(games.map((game) => game.season))).sort((a, b) => b - a),
    [games],
  );

  const rounds = useMemo(
    () =>
      Array.from(new Set(games.map((game) => game.round))).sort((left, right) => {
        const order = ["First Four", "Round of 64", "Round of 32", "Sweet 16", "Elite Eight", "Final Four", "Championship"];
        return order.indexOf(left) - order.indexOf(right);
      }),
    [games],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return games.filter((game) => {
      if (season !== "all" && String(game.season) !== season) {
        return false;
      }
      if (round !== "all" && game.round !== round) {
        return false;
      }
      if (outcome === "upset" && !game.seedUpset) {
        return false;
      }
      if (outcome === "chalk" && game.seedUpset) {
        return false;
      }
      if (confidence === "low" && game.confidence >= 0.65) {
        return false;
      }
      if (confidence === "mid" && (game.confidence < 0.65 || game.confidence >= 0.82)) {
        return false;
      }
      if (confidence === "high" && game.confidence < 0.82) {
        return false;
      }
      if (seedGap !== "all" && game.seedGap < Number(seedGap)) {
        return false;
      }
      if (normalizedQuery && !getHistoricalGameSearchText(game).includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [confidence, games, outcome, query, round, season, seedGap]);

  return (
    <section className="stack-lg">
      <div className="panel filter-bar">
        <div className="filter-bar__summary">
          <div>
            <p className="panel__kicker">Explorer filters</p>
            <strong>
              {filtered.length} of {games.length} games shown
            </strong>
          </div>
          <p className="muted">Search by team, round, notes, signals, or analysis text.</p>
        </div>
        <div className="filter-bar__controls">
          <label>
            Search
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Team, note, signal, or analysis text"
            />
          </label>
          <label>
            Season
            <select value={season} onChange={(event) => setSeason(event.target.value)}>
              <option value="all">All</option>
              {seasons.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label>
            Round
            <select value={round} onChange={(event) => setRound(event.target.value)}>
              <option value="all">All</option>
              {rounds.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label>
            Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)}>
              <option value="all">All games</option>
              <option value="upset">Upsets only</option>
              <option value="chalk">Favorite wins only</option>
            </select>
          </label>
          <label>
            Confidence
            <select value={confidence} onChange={(event) => setConfidence(event.target.value as typeof confidence)}>
              <option value="all">All</option>
              <option value="low">Lower confidence</option>
              <option value="mid">Middle confidence</option>
              <option value="high">Higher confidence</option>
            </select>
          </label>
          <label>
            Seed gap
            <select value={seedGap} onChange={(event) => setSeedGap(event.target.value as typeof seedGap)}>
              <option value="all">Any</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="4">4+</option>
            </select>
          </label>
        </div>
      </div>
      <div className="card-grid">
        {filtered.map((game) => (
          <GameCard key={game.gameId} game={game} />
        ))}
      </div>
    </section>
  );
}
