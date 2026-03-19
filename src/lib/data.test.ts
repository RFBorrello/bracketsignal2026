import test from "node:test";
import assert from "node:assert/strict";

import { emptyBracketState, getSlotTeams, setPick, teamKey } from "@/lib/bracket";
import {
  getBracketSignalProjection,
  getDataset,
  getHistoricalGameAnalysis,
  getHistoricalUpsets,
  getTopUpsetCandidates,
  getTournament2026Matchups,
} from "@/lib/data";

test("dataset exposes games and upsets", () => {
  const dataset = getDataset();
  assert.ok(dataset.games.length > 0);
  assert.ok(getHistoricalUpsets().length > 0);
});

test("historical analysis view synthesizes richer sections", () => {
  const game = getDataset().games[0];
  const analysis = getHistoricalGameAnalysis(game);

  assert.ok(analysis.summary.length > 0);
  assert.ok(analysis.quantitativeHighlights.length > 0);
  assert.ok(analysis.qualitativeHighlights.length > 0);
  assert.ok(analysis.sections.length >= 2);
});

test("2026 matchups inherit generated analysis and analogs", () => {
  const matchups = getTournament2026Matchups();
  const topCandidate = getTopUpsetCandidates()[0];
  const liveStatsMatchup = matchups.find((matchup) => matchup.statSnapshotUpdated);

  assert.equal(matchups.length, 32);
  assert.ok(topCandidate.favoriteCaseSummary.length > 0);
  assert.ok(topCandidate.underdogCaseSummary.length > 0);
  assert.ok(topCandidate.topSignals.length > 0);
  assert.ok(topCandidate.upsetSignals.length > 0);
  assert.ok(topCandidate.analysisSections.length >= 3);
  assert.ok(topCandidate.editorialNotes.length > 0);
  assert.ok(topCandidate.comparisonRows.length >= 4);
  assert.ok(liveStatsMatchup);
  assert.ok((liveStatsMatchup?.statComparisonRows.length ?? 0) >= 6);
});

test("bracket pruning drops invalid downstream picks when an upstream pick changes", () => {
  let state = emptyBracketState();
  const [eastOne, eastSixteen] = getSlotTeams("east-r1-1", state);
  state = setPick(state, "east-r1-1", teamKey(eastOne));

  const [eastEight] = getSlotTeams("east-r1-2", state);
  state = setPick(state, "east-r1-2", teamKey(eastEight));

  const [roundTwoTop] = getSlotTeams("east-r2-1", state);
  state = setPick(state, "east-r2-1", teamKey(roundTwoTop));

  state = setPick(state, "east-r1-1", teamKey(eastSixteen));
  assert.equal(state.picks["east-r2-1"], undefined);
});

test("Bracket Signal projection fills the entire bracket with explanations", () => {
  const projection = getBracketSignalProjection();
  const projectionV2 = getBracketSignalProjection("v2");
  const titleGame = projection.games.find((game) => game.slotId === "title-game");
  const baselineRound64Upsets = projection.games.filter((game) => game.roundNumber === 1 && game.upsetPick).length;
  const v2Round64Upsets = projectionV2.games.filter((game) => game.roundNumber === 1 && game.upsetPick).length;

  assert.equal(projection.games.length, 63);
  assert.ok(projection.champion);
  assert.ok(titleGame);
  assert.ok(titleGame?.projectedWinner.name.length);
  assert.ok(titleGame?.analysisSections.length);
  assert.ok(titleGame?.quantitativeHighlights.length);
  assert.ok(titleGame?.editorialNotes.length);
  assert.ok(v2Round64Upsets > baselineRound64Upsets);
});
