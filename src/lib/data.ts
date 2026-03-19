import datasetJson from "../../data/processed/dataset.json";
import liveTeamStatsJson from "../../data/processed/team-stats-2026.json";
import { finalFourSlots, regionBrackets } from "@/lib/2026-bracket";
import { datasetSchema } from "@/lib/schemas";
import {
  BracketSlot,
  BracketSignalProjection,
  BracketState,
  Dataset,
  EditorialNote,
  GameRecord,
  HistoricalAnalysis,
  HistoricalAnalysisSection,
  HistoricalGameAnalysis,
  MatchupComparisonRow,
  MatchupPreview,
  ProjectedBracketGame,
  Signal,
  SourceReference,
  TeamSeasonProfile,
  TeamSeed,
} from "@/lib/types";
import { percent } from "@/lib/format";

type HistoricalGameRecord = GameRecord & {
  analysis?: HistoricalAnalysis;
  analysisSummary?: string;
  favoriteSummary?: string;
  upsetSummary?: string;
  quantitativeHighlights?: string[];
  qualitativeHighlights?: string[];
  analysisSections?: HistoricalAnalysisSection[];
  analogSummary?: string;
  modelMissSummary?: string;
};

type RecordSummary = {
  wins: number;
  losses: number;
  winPct: number;
  playIn: boolean;
};

type ExtendedTeamSeasonProfile = TeamSeasonProfile & {
  recentNetRating?: number;
  recentWinPct?: number;
  conference?: string;
  coach?: string;
};

type CurrentMetricKey =
  | "scoringOffense"
  | "scoringDefense"
  | "scoringMargin"
  | "threePointPct"
  | "threePointPctDefense"
  | "offensiveReboundsPerGame"
  | "turnoversPerGame"
  | "assistTurnoverRatio"
  | "turnoverMargin"
  | "turnoversForcedPerGame";

type CurrentTeamStat = {
  rank: number | null;
  value: number;
  display: string;
  games: number;
};

type CurrentTeamRecord = {
  rank: number | null;
  wins: number;
  losses: number;
  pct: number | null;
  display: string;
  games: number;
};

type CurrentTeamStatsEntry = {
  team: string;
  sourceTeam: string | null;
  record?: CurrentTeamRecord;
  stats: Partial<Record<CurrentMetricKey, CurrentTeamStat>>;
};

type CurrentTeamStatsSnapshot = {
  generatedAt: string;
  updated: string;
  source: SourceReference;
  recordMetric?: { statId: number; title: string; valueField: string };
  metrics: Record<CurrentMetricKey, { statId: number; title: string; valueField: string }>;
  teams: Record<string, CurrentTeamStatsEntry>;
  missing: Record<string, string[]>;
};

const dataset = datasetSchema.parse(datasetJson) as Dataset;
const gameMap = new Map(dataset.games.map((game) => [game.gameId, game]));
const roundOf64Games = dataset.games.filter((game) => game.round === "Round of 64");
const latestProfileSeason = dataset.summary.latestSeason;
const currentTeamStatsSnapshot = liveTeamStatsJson as CurrentTeamStatsSnapshot;
const currentTeamStatsByName = new Map<string, CurrentTeamStatsEntry>(Object.entries(currentTeamStatsSnapshot.teams));

const kaggleSource: SourceReference = {
  label: "Kaggle March Machine Learning Mania 2026 data",
  url: "https://www.kaggle.com/competitions/march-machine-learning-mania-2026/data",
};

const tournamentFieldSource: SourceReference = {
  label: "Embedded 2026 bracket field",
  url: "https://www.ncaa.com/march-madness-live/bracket",
};

const ncaaCurrentStatsSource: SourceReference = currentTeamStatsSnapshot.source;

const roundOf64BySeed = new Map<string, GameRecord[]>();
const roundOf64ByGap = new Map<number, GameRecord[]>();
const gamesByRoundSeed = new Map<string, GameRecord[]>();
const gamesByRoundGap = new Map<string, GameRecord[]>();
const gamesBySeed = new Map<string, GameRecord[]>();
const gamesByGap = new Map<number, GameRecord[]>();
const latestTeamProfilesByName = new Map<string, ExtendedTeamSeasonProfile>();

for (const game of dataset.games) {
  const seedKey = `${game.favoriteSeed}-${game.underdogSeed}`;
  const roundSeedKey = `${game.round}:${seedKey}`;
  const roundGapKey = `${game.round}:${game.seedGap}`;
  gamesBySeed.set(seedKey, [...(gamesBySeed.get(seedKey) ?? []), game]);
  gamesByGap.set(game.seedGap, [...(gamesByGap.get(game.seedGap) ?? []), game]);
  gamesByRoundSeed.set(roundSeedKey, [...(gamesByRoundSeed.get(roundSeedKey) ?? []), game]);
  gamesByRoundGap.set(roundGapKey, [...(gamesByRoundGap.get(roundGapKey) ?? []), game]);
}

for (const game of roundOf64Games) {
  const seedKey = `${game.favoriteSeed}-${game.underdogSeed}`;
  roundOf64BySeed.set(seedKey, [...(roundOf64BySeed.get(seedKey) ?? []), game]);
  roundOf64ByGap.set(game.seedGap, [...(roundOf64ByGap.get(game.seedGap) ?? []), game]);
}

for (const profile of (dataset.teamProfiles as ExtendedTeamSeasonProfile[])
  .filter((profile) => profile.season === latestProfileSeason)
  .sort((left, right) => right.season - left.season || right.netRating - left.netRating)) {
  const key = normalizeTeamName(profile.team);
  if (!latestTeamProfilesByName.has(key)) {
    latestTeamProfilesByName.set(key, profile);
  }
}

const conferenceTierMap: Record<string, number> = {
  sec: 4.6,
  big_ten: 4.5,
  big_12: 4.5,
  acc: 4.2,
  big_east: 4.1,
  pac_12: 3.6,
  big_west: 2.5,
  mountain_west: 3.4,
  mvc: 3.0,
  a_10: 3.2,
  aac: 3.0,
  wcc: 3.3,
  mwc: 3.4,
  summit: 2.1,
  southland: 1.9,
  mac: 2.4,
  sun_belt: 2.5,
  ivy: 2.2,
  horizon: 2.1,
  caa: 2.3,
  maac: 1.9,
  nec: 1.6,
  wac: 2.0,
  southern: 1.9,
  c_usa: 2.3,
  asun: 1.9,
  ovc: 1.8,
  big_sky: 1.8,
  patriot: 1.8,
  meac: 1.5,
  swac: 1.5,
  first_four: 2.2,
};

const teamNameAliasMap: Record<string, string> = {
  uconn: "connecticut",
  saintlouis: "stlouis",
  stlouis: "stlouis",
  saintmarys: "stmarysca",
  stmarys: "stmarysca",
  miamioh: "miamioh",
  miamiofohio: "miamioh",
  michiganstate: "michiganst",
  iowastate: "iowast",
  ohiostate: "ohiost",
  stjohns: "stjohns",
  texasam: "texasam",
  va_commonwealth: "vcu",
};

function asHistoricalGame(game: GameRecord): HistoricalGameRecord {
  return game as HistoricalGameRecord;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function signalSummary(signal: Signal): string {
  return `${signal.label}: ${signal.value} - ${signal.detail}`;
}

function noteSummary(note: EditorialNote): string {
  return `${note.tag}: ${note.summary}`;
}

function sourceSummary(source: SourceReference): string {
  return source.label;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function normalizeConference(conference: string): string {
  return conference
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/saint/g, "st")
    .replace(/state/g, "st")
    .replace(/\(oh\)/g, "oh")
    .replace(/\(ca\)/g, "ca")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function conferenceTier(conference: string): number {
  return conferenceTierMap[normalizeConference(conference)] ?? 2.2;
}

function teamProfileFor(teamName: string): ExtendedTeamSeasonProfile | undefined {
  if (teamName.includes("/")) {
    return undefined;
  }
  const normalized = normalizeTeamName(teamName);
  const alias = teamNameAliasMap[normalized] ?? normalized;
  return latestTeamProfilesByName.get(alias);
}

const currentMetricDescriptors: Array<{
  key: CurrentMetricKey;
  label: string;
  lowerIsBetter?: boolean;
  neutralBand: number;
  rationale: string;
}> = [
  {
    key: "scoringOffense",
    label: "Scoring offense",
    neutralBand: 1.4,
    rationale: "Raw scoring pressure matters because favorites that can create points without perfect shot quality are harder to spring on late.",
  },
  {
    key: "scoringDefense",
    label: "Scoring defense",
    lowerIsBetter: true,
    neutralBand: 1.3,
    rationale: "Points allowed is the quickest public proxy for whether a defense can drag an opponent below its comfort zone.",
  },
  {
    key: "scoringMargin",
    label: "Scoring margin",
    neutralBand: 1.5,
    rationale: "Scoring margin is the cleanest public shorthand for whether a team tends to separate over 40 minutes rather than just survive.",
  },
  {
    key: "threePointPct",
    label: "3-point percentage",
    neutralBand: 1.0,
    rationale: "Three-point accuracy is one of the clearest ways underdogs keep up with superior size or depth.",
  },
  {
    key: "threePointPctDefense",
    label: "3-point defense",
    lowerIsBetter: true,
    neutralBand: 1.0,
    rationale: "Limiting opponent threes matters because clean perimeter volume is a common upset accelerant.",
  },
  {
    key: "offensiveReboundsPerGame",
    label: "Offensive rebounding",
    neutralBand: 0.8,
    rationale: "Second-chance possessions are one of the fastest ways to beat a seed line and steal extra scoring trips.",
  },
  {
    key: "turnoversPerGame",
    label: "Turnovers per game",
    lowerIsBetter: true,
    neutralBand: 0.55,
    rationale: "Ball security keeps favorites from donating chaos and gives underdogs fewer free-run opportunities.",
  },
  {
    key: "assistTurnoverRatio",
    label: "Assist/turnover ratio",
    neutralBand: 0.08,
    rationale: "This is the best quick public check on whether a team turns creation into clean possessions instead of empty ones.",
  },
  {
    key: "turnoverMargin",
    label: "Turnover margin",
    neutralBand: 0.45,
    rationale: "Positive turnover margin is one of the cleaner public markers for who is more likely to win the possession count.",
  },
  {
    key: "turnoversForcedPerGame",
    label: "Turnovers forced",
    neutralBand: 0.7,
    rationale: "Forcing turnovers is a direct way to inject variance, which is especially valuable for underdogs hunting disruption.",
  },
];

function formatCurrentMetricValue(metric: CurrentMetricKey, value: number): string {
  if (
    metric === "threePointPct" ||
    metric === "threePointPctDefense"
  ) {
    return `${value.toFixed(1)}%`;
  }
  if (metric === "assistTurnoverRatio" || metric === "turnoverMargin") {
    return value.toFixed(2);
  }
  return value.toFixed(1);
}

function rankLabel(rank: number | null): string {
  return rank === null ? "unranked nationally" : `No. ${rank}`;
}

function currentTeamStatsFor(teamName: string): CurrentTeamStatsEntry | undefined {
  const direct = currentTeamStatsByName.get(teamName);
  if (direct) {
    return direct;
  }
  if (!teamName.includes("/")) {
    return undefined;
  }

  const parts = teamName.split("/").map((part) => part.trim()).filter(Boolean);
  const resolved = parts
    .map((part) => currentTeamStatsByName.get(part))
    .filter((entry): entry is CurrentTeamStatsEntry => Boolean(entry));

  if (resolved.length !== parts.length) {
    return undefined;
  }

  const stats: Partial<Record<CurrentMetricKey, CurrentTeamStat>> = {};
  const records = resolved.map((entry) => entry.record).filter((entry): entry is CurrentTeamRecord => Boolean(entry));
  for (const descriptor of currentMetricDescriptors) {
    const metricStats = resolved
      .map((entry) => entry.stats[descriptor.key])
      .filter((entry): entry is CurrentTeamStat => Boolean(entry));
    if (metricStats.length !== resolved.length) {
      continue;
    }

    const rankedValues = metricStats
      .map((entry) => entry.rank)
      .filter((rank): rank is number => rank !== null);
    const averageValue = average(metricStats.map((entry) => entry.value));

    stats[descriptor.key] = {
      rank: rankedValues.length === metricStats.length ? Math.round(average(rankedValues)) : null,
      value: averageValue,
      display: formatCurrentMetricValue(descriptor.key, averageValue),
      games: Math.round(average(metricStats.map((entry) => entry.games))),
    };
  }

  const averagedRecord =
    records.length === resolved.length
      ? {
          rank:
            records.every((entry) => entry.rank !== null)
              ? Math.round(average(records.map((entry) => entry.rank as number)))
              : null,
          wins: Math.round(average(records.map((entry) => entry.wins))),
          losses: Math.round(average(records.map((entry) => entry.losses))),
          pct: average(records.map((entry) => entry.pct ?? 0)),
          display: `${Math.round(average(records.map((entry) => entry.wins)))}-${Math.round(average(records.map((entry) => entry.losses)))}`,
          games: Math.round(average(records.map((entry) => entry.games))),
        }
      : undefined;

  return {
    team: teamName,
    sourceTeam: resolved.map((entry) => entry.sourceTeam ?? entry.team).join(" / "),
    record: averagedRecord,
    stats,
  };
}

function hydrateTeamSeedRecord(team: TeamSeed): TeamSeed {
  const liveRecord = currentTeamStatsFor(team.name)?.record?.display;
  if (!liveRecord || liveRecord === team.record) {
    return team;
  }
  return {
    ...team,
    record: liveRecord,
  };
}

function buildCurrentStatComparisonRows(
  favoriteTeam: string,
  underdogTeam: string,
  favoriteStats: CurrentTeamStatsEntry | undefined,
  underdogStats: CurrentTeamStatsEntry | undefined,
): MatchupComparisonRow[] {
  if (!favoriteStats || !underdogStats) {
    return [];
  }

  return currentMetricDescriptors.flatMap((descriptor) => {
    const favoriteMetric = favoriteStats.stats[descriptor.key];
    const underdogMetric = underdogStats.stats[descriptor.key];
    if (!favoriteMetric || !underdogMetric) {
      return [];
    }

    const gap = Math.abs(favoriteMetric.value - underdogMetric.value);
    const lean =
      gap <= descriptor.neutralBand
        ? "neutral"
        : descriptor.lowerIsBetter
          ? favoriteMetric.value < underdogMetric.value
            ? "favorite"
            : "underdog"
          : favoriteMetric.value > underdogMetric.value
            ? "favorite"
            : "underdog";

    return [
      {
        label: descriptor.label,
        favoriteValue: favoriteMetric.display,
        underdogValue: underdogMetric.display,
        lean,
        rationale: `${descriptor.rationale} Current NCAA ranks: ${favoriteTeam} ${rankLabel(favoriteMetric.rank)}, ${underdogTeam} ${rankLabel(underdogMetric.rank)}.`,
      },
    ];
  });
}

function buildCurrentStatSignals(
  favoriteTeam: TeamSeed,
  underdogTeam: TeamSeed,
  favoriteStats: CurrentTeamStatsEntry | undefined,
  underdogStats: CurrentTeamStatsEntry | undefined,
): {
  favoriteSignals: Signal[];
  upsetSignals: Signal[];
  editorialNotes: EditorialNote[];
  probabilityDelta: number;
  volatilityDelta: number;
} {
  if (!favoriteStats || !underdogStats) {
    return {
      favoriteSignals: [],
      upsetSignals: [],
      editorialNotes: [],
      probabilityDelta: 0,
      volatilityDelta: 0,
    };
  }

  const favoriteSignals: Signal[] = [];
  const upsetSignals: Signal[] = [];
  const editorialNotes: EditorialNote[] = [];
  let probabilityDelta = 0;
  let volatilityDelta = 0;

  const favoriteMargin = favoriteStats.stats.scoringMargin?.value ?? 0;
  const underdogMargin = underdogStats.stats.scoringMargin?.value ?? 0;
  const favoriteDefense = favoriteStats.stats.scoringDefense?.value ?? 0;
  const underdogDefense = underdogStats.stats.scoringDefense?.value ?? 0;
  const favoriteThrees = favoriteStats.stats.threePointPct?.value ?? 0;
  const underdogThrees = underdogStats.stats.threePointPct?.value ?? 0;
  const favoriteThreeDefense = favoriteStats.stats.threePointPctDefense?.value ?? 0;
  const underdogThreeDefense = underdogStats.stats.threePointPctDefense?.value ?? 0;
  const favoriteTurnovers = favoriteStats.stats.turnoversPerGame?.value ?? 0;
  const underdogTurnovers = underdogStats.stats.turnoversPerGame?.value ?? 0;
  const favoriteForced = favoriteStats.stats.turnoversForcedPerGame?.value ?? 0;
  const underdogForced = underdogStats.stats.turnoversForcedPerGame?.value ?? 0;
  const favoriteBoards = favoriteStats.stats.offensiveReboundsPerGame?.value ?? 0;
  const underdogBoards = underdogStats.stats.offensiveReboundsPerGame?.value ?? 0;

  if (favoriteMargin >= underdogMargin + 4) {
    favoriteSignals.push({
      label: "Current scoring margin",
      direction: "favorite",
      value: `${favoriteMargin.toFixed(1)} vs ${underdogMargin.toFixed(1)}`,
      strength: 0.63,
      detail: `${favoriteTeam.name} has separated opponents more consistently over the 2025-26 season, which usually supports the favorite path late.`,
    });
    probabilityDelta += 0.035;
  } else if (underdogMargin >= favoriteMargin + 3) {
    upsetSignals.push({
      label: "Current scoring margin",
      direction: "underdog",
      value: `${underdogMargin.toFixed(1)} vs ${favoriteMargin.toFixed(1)}`,
      strength: 0.61,
      detail: `${underdogTeam.name} has posted the stronger current-season scoring margin, a real warning sign when the bracket line still leans favorite.`,
    });
    probabilityDelta -= 0.03;
    volatilityDelta += 0.03;
  }

  if (favoriteDefense > 0 && underdogDefense > 0) {
    if (favoriteDefense <= underdogDefense - 3) {
      favoriteSignals.push({
        label: "Current scoring defense",
        direction: "favorite",
        value: `${favoriteDefense.toFixed(1)} allowed`,
        strength: 0.58,
        detail: `${favoriteTeam.name} has been materially better at suppressing points, which is one of the cleaner current-season favorite signals.`,
      });
      probabilityDelta += 0.025;
    } else if (underdogDefense <= favoriteDefense - 2.5) {
      upsetSignals.push({
        label: "Current scoring defense",
        direction: "underdog",
        value: `${underdogDefense.toFixed(1)} allowed`,
        strength: 0.56,
        detail: `${underdogTeam.name} defends at a level that can drag the game into a shorter-possession upset script.`,
      });
      probabilityDelta -= 0.022;
      volatilityDelta += 0.02;
    }
  }

  if (underdogThrees >= favoriteThrees + 2) {
    upsetSignals.push({
      label: "3-point shotmaking",
      direction: "underdog",
      value: `${underdogThrees.toFixed(1)}%`,
      strength: 0.55,
      detail: `${underdogTeam.name} is the better current-season 3-point shooting team, which is one of the most common ways underdogs stay attached.`,
    });
    probabilityDelta -= 0.018;
    volatilityDelta += 0.028;
  } else if (favoriteThrees >= underdogThrees + 2) {
    favoriteSignals.push({
      label: "3-point shotmaking",
      direction: "favorite",
      value: `${favoriteThrees.toFixed(1)}%`,
      strength: 0.53,
      detail: `${favoriteTeam.name} brings the cleaner current-season perimeter shooting profile into the matchup.`,
    });
    probabilityDelta += 0.016;
  }

  if (favoriteThreeDefense > 0 && underdogThreeDefense > 0) {
    if (favoriteThreeDefense <= underdogThreeDefense - 2) {
      favoriteSignals.push({
        label: "3-point defense",
        direction: "favorite",
        value: `${favoriteThreeDefense.toFixed(1)}% allowed`,
        strength: 0.54,
        detail: `${favoriteTeam.name} has done a better job taking away the arc, which matters against upset-minded teams hunting variance.`,
      });
      probabilityDelta += 0.016;
    } else if (underdogThreeDefense <= favoriteThreeDefense - 2) {
      upsetSignals.push({
        label: "3-point defense",
        direction: "underdog",
        value: `${underdogThreeDefense.toFixed(1)}% allowed`,
        strength: 0.52,
        detail: `${underdogTeam.name} is better equipped to flatten the favorite's easiest source of spacing.`,
      });
      probabilityDelta -= 0.014;
      volatilityDelta += 0.015;
    }
  }

  if (favoriteTurnovers > 0 && underdogTurnovers > 0) {
    if (favoriteTurnovers <= underdogTurnovers - 1) {
      favoriteSignals.push({
        label: "Ball security",
        direction: "favorite",
        value: `${favoriteTurnovers.toFixed(1)} TOPG`,
        strength: 0.49,
        detail: `${favoriteTeam.name} gives away fewer possessions, which reduces the easiest upset accelerant.`,
      });
      probabilityDelta += 0.012;
    } else if (underdogTurnovers <= favoriteTurnovers - 1) {
      upsetSignals.push({
        label: "Ball security",
        direction: "underdog",
        value: `${underdogTurnovers.toFixed(1)} TOPG`,
        strength: 0.47,
        detail: `${underdogTeam.name} protects the ball better, which is exactly how lower seeds keep stronger teams from separating.`,
      });
      probabilityDelta -= 0.011;
    }
  }

  if (underdogForced >= favoriteForced + 1.5) {
    upsetSignals.push({
      label: "Turnover pressure",
      direction: "underdog",
      value: `${underdogForced.toFixed(1)} forced`,
      strength: 0.5,
      detail: `${underdogTeam.name} creates more live-ball chaos, which raises the volatility of the entire game.`,
    });
    volatilityDelta += 0.025;
  } else if (favoriteForced >= underdogForced + 1.5) {
    favoriteSignals.push({
      label: "Turnover pressure",
      direction: "favorite",
      value: `${favoriteForced.toFixed(1)} forced`,
      strength: 0.48,
      detail: `${favoriteTeam.name} is more likely to win possessions back through current-season turnover pressure.`,
    });
    probabilityDelta += 0.01;
  }

  if (underdogBoards >= favoriteBoards + 1.2) {
    upsetSignals.push({
      label: "Offensive glass",
      direction: "underdog",
      value: `${underdogBoards.toFixed(1)} OREB`,
      strength: 0.48,
      detail: `${underdogTeam.name} creates extra possessions on the glass, which is one of the more repeatable upset ingredients.`,
    });
    volatilityDelta += 0.018;
  }

  return {
    favoriteSignals,
    upsetSignals,
    editorialNotes,
    probabilityDelta: clamp(probabilityDelta, -0.08, 0.08),
    volatilityDelta: clamp(volatilityDelta, 0, 0.08),
  };
}

function parseRecord(record: string): RecordSummary {
  const match = record.match(/(\d+)-(\d+)/);
  if (!match) {
    return { wins: 0, losses: 0, winPct: 0.5, playIn: /play-in/i.test(record) };
  }
  const wins = Number(match[1]);
  const losses = Number(match[2]);
  return {
    wins,
    losses,
    winPct: wins + losses > 0 ? wins / (wins + losses) : 0.5,
    playIn: /play-in/i.test(record),
  };
}

function getGamesByIds(gameIds: string[]): GameRecord[] {
  return gameIds.map((gameId) => gameMap.get(gameId)).filter((game): game is GameRecord => Boolean(game));
}

function buildFallbackOverview(game: GameRecord): string {
  if (game.seedUpset) {
    return `${game.underdog} converted a ${game.favoriteSeed}-${game.underdogSeed} matchup into an upset by keeping the game inside the modeled variance band.`;
  }

  return `${game.favorite} kept control of a ${game.favoriteSeed}-${game.underdogSeed} matchup with a ${percent(game.favoriteWinProbability)} favorite read and enough pregame stability to survive.`;
}

function buildFallbackFavoriteSummary(game: GameRecord): string {
  if (game.favoriteWon) {
    return `${game.favorite} validated the favorite profile by holding the efficiency and possession edges that the pregame model liked.`;
  }

  return `${game.favorite} still carried the cleaner statistical profile, but it was not enough to close the upset window.`;
}

function buildFallbackUpsetSummary(game: GameRecord): string {
  if (game.seedUpset) {
    return `${game.underdog} found a route through shooting variance, possession discipline, or matchup leverage before the favorite's edge fully materialized.`;
  }

  return `${game.favorite} prevented the upset path from compounding into a game-defining run.`;
}

function buildQuantitativeHighlights(game: GameRecord, source: HistoricalGameRecord): string[] {
  return uniqueStrings([
    ...(source.analysis?.quantitativeHighlights ?? []),
    ...(source.quantitativeHighlights ?? []),
    `Seed line ${game.favoriteSeed}-${game.underdogSeed}`,
    `Seed gap ${game.seedGap}`,
    `Favorite win probability ${percent(game.favoriteWinProbability)}`,
    `Upset likelihood ${percent(game.upsetLikelihood)}`,
    `Volatility ${percent(game.volatility)}`,
    `Confidence ${percent(game.confidence)}`,
    game.marketUpset === null ? "Market upset data unavailable" : `Market upset ${game.marketUpset ? "yes" : "no"}`,
    `Model upset ${game.modelUpset ? "yes" : "no"}`,
    ...game.topSignals.slice(0, 3).map(signalSummary),
    ...game.upsetSignals.slice(0, 3).map(signalSummary),
  ]);
}

function buildQualitativeHighlights(game: GameRecord, source: HistoricalGameRecord): string[] {
  const highlights = uniqueStrings([
    ...(source.analysis?.qualitativeHighlights ?? []),
    ...(source.qualitativeHighlights ?? []),
    ...game.editorialNotes.slice(0, 4).map(noteSummary),
    ...game.sourceProvenance.slice(0, 2).map(sourceSummary),
  ]);

  if (highlights.length === 0) {
    highlights.push("No bespoke qualitative notes attached yet.");
  }

  return highlights;
}

function buildSections(game: GameRecord, source: HistoricalGameRecord, overview: string): HistoricalAnalysisSection[] {
  const explicitSections = source.analysis?.sections ?? source.analysisSections;
  if (explicitSections && explicitSections.length > 0) {
    return explicitSections;
  }

  const favoriteHighlights = uniqueStrings([
    buildFallbackFavoriteSummary(game),
    ...game.topSignals.slice(0, 3).map(signalSummary),
  ]);
  const upsetHighlights = uniqueStrings([
    buildFallbackUpsetSummary(game),
    ...game.upsetSignals.slice(0, 3).map(signalSummary),
  ]);
  const noteHighlights = buildQualitativeHighlights(game, source).slice(0, 4);
  const analogHighlights = getGamesByIds(game.historicalAnalogs)
    .slice(0, 4)
    .map((analog) => `${analog.season} ${analog.round} - ${analog.underdog} over ${analog.favorite}`);

  return [
    {
      title: game.favoriteWon ? "Why the favorite held" : "Why the favorite was vulnerable",
      summary: overview,
      highlights: favoriteHighlights.slice(0, 5),
      tone: "favorite",
    },
    {
      title: game.seedUpset ? "Why the upset landed" : "Why the upset did not land",
      summary: game.seedUpset
        ? "The underdog exploited the edge that the model had left open."
        : "The underdog's statistical case never fully converted into a result.",
      highlights: upsetHighlights.slice(0, 5),
      tone: "underdog",
    },
    {
      title: "Qualitative context",
      summary: game.editorialNotes.length > 0
        ? "Editorial notes explain the matchup texture that the pregame numbers only approximated."
        : "The page falls back to the structured quantitative frame because no bespoke notes were attached.",
      highlights: noteHighlights,
      tone: "neutral",
    },
    {
      title: "Historical analogs",
      summary: analogHighlights.length > 0
        ? "These prior games match the same seed pattern or upset profile."
        : "No analogs were linked for this record yet.",
      highlights: analogHighlights,
      tone: "neutral",
    },
  ];
}

function countUniqueSources(game: GameRecord): number {
  const sources = new Set<string>();
  for (const reference of game.sourceProvenance) {
    sources.add(reference.label);
  }
  for (const note of game.editorialNotes) {
    for (const reference of note.sources) {
      sources.add(reference.label);
    }
  }
  return sources.size;
}

function sortSignal(left: Signal, right: Signal): number {
  return right.strength - left.strength;
}

function classicUpsetTag(favoriteSeed: number, underdogSeed: number): string | null {
  if (favoriteSeed === 5 && underdogSeed === 12) {
    return "12/5 trap";
  }
  if (favoriteSeed === 6 && underdogSeed === 11) {
    return "Live 11-seed";
  }
  if (favoriteSeed === 7 && underdogSeed === 10) {
    return "Coin-flip 7/10";
  }
  if (favoriteSeed === 4 && underdogSeed === 13) {
    return "13/4 pressure";
  }
  return null;
}

function buildTeamSignals(
  favoriteTeam: TeamSeed,
  underdogTeam: TeamSeed,
  favoriteRecord: RecordSummary,
  underdogRecord: RecordSummary,
  favoriteWinProbability: number,
  upsetLikelihood: number,
  historicalUpsetRate: number,
  historicalSampleSize: number,
): {
  tags: MatchupPreview["tags"];
  topSignals: Signal[];
  upsetSignals: Signal[];
  editorialNotes: EditorialNote[];
} {
  const favoriteConferenceTier = conferenceTier(favoriteTeam.conference);
  const underdogConferenceTier = conferenceTier(underdogTeam.conference);
  const conferenceGap = favoriteConferenceTier - underdogConferenceTier;
  const winPctGap = favoriteRecord.winPct - underdogRecord.winPct;
  const seedGap = underdogTeam.seed - favoriteTeam.seed;

  const tags: MatchupPreview["tags"] = [];
  const topSignals: Signal[] = [];
  const upsetSignals: Signal[] = [];
  const editorialNotes: EditorialNote[] = [];

  const exactSeedTag = classicUpsetTag(favoriteTeam.seed, underdogTeam.seed);
  if (exactSeedTag) {
    tags.push({ label: exactSeedTag, tone: upsetLikelihood >= 0.33 ? "alert" : "neutral" });
  }
  if (historicalUpsetRate >= 0.3) {
    tags.push({ label: "Historical upset lane", tone: "alert" });
  }
  if (underdogRecord.wins >= 27) {
    tags.push({ label: "30-win pressure", tone: "alert" });
  }
  if (conferenceGap >= 1.3) {
    tags.push({ label: "Power-league favorite", tone: "favorite" });
  }
  if (underdogRecord.playIn) {
    tags.push({ label: "Play-in carryover", tone: "neutral" });
  }
  if (favoriteWinProbability >= 0.74) {
    tags.push({ label: "Favorite cushion", tone: "favorite" });
  }
  if (Math.abs(winPctGap) <= 0.045) {
    tags.push({ label: "Record parity", tone: "neutral" });
  }

  const addSignal = (
    bucket: Signal[],
    label: string,
    direction: "favorite" | "underdog",
    value: string,
    strength: number,
    detail: string,
  ) => {
    bucket.push({ label, direction, value, strength: clamp(strength, 0.15, 0.95), detail });
  };

  addSignal(
    topSignals,
    "Seed-line control",
    "favorite",
    `${favoriteTeam.seed} seed`,
    0.38 + seedGap * 0.035,
    `${favoriteTeam.name} starts with the cleaner bracket line and avoids the classic underdog leverage of a tighter seed profile.`,
  );

  if (winPctGap > 0.02) {
    addSignal(
      topSignals,
      "Season record edge",
      "favorite",
      `${(winPctGap * 100).toFixed(1)} pts`,
      0.35 + winPctGap * 2.2,
      `${favoriteTeam.name} won at a meaningfully higher clip than ${underdogTeam.name} entering the tournament.`,
    );
  }
  if (conferenceGap > 0.5) {
    addSignal(
      topSignals,
      "Conference caliber",
      "favorite",
      `${conferenceGap.toFixed(1)} tier gap`,
      0.36 + conferenceGap * 0.08,
      `${favoriteTeam.name} played the heavier schedule context, which usually gives the favorite profile more tested edges.`,
    );
  }
  if (historicalUpsetRate < 0.18 && historicalSampleSize > 0) {
    addSignal(
      topSignals,
      "Seed-history stability",
      "favorite",
      `${Math.round((1 - historicalUpsetRate) * 100)}%`,
      0.48,
      `This seed line has mostly held historically, which supports the favorite path more than the upset story.`,
    );
  }

  if (historicalUpsetRate >= 0.2) {
    addSignal(
      upsetSignals,
      "Seed-line upset history",
      "underdog",
      `${Math.round(historicalUpsetRate * 100)}%`,
      0.38 + historicalUpsetRate,
      `${favoriteTeam.seed}/${underdogTeam.seed} games have produced enough historical misses to keep the underdog lane real.`,
    );
  }
  if (underdogRecord.winPct >= favoriteRecord.winPct - 0.03) {
    addSignal(
      upsetSignals,
      "Comparable season record",
      "underdog",
      `${Math.round(underdogRecord.winPct * 100)}%`,
      0.34 + Math.max(0, 0.03 - Math.max(0, winPctGap)) * 4,
      `${underdogTeam.name} does not arrive with an obviously weaker win profile than the favorite.`,
    );
  }
  if (underdogRecord.wins >= 27) {
    addSignal(
      upsetSignals,
      "Underdog momentum",
      "underdog",
      `${underdogRecord.wins} wins`,
      0.46,
      `${underdogTeam.name} has the kind of season-long momentum that often turns a nominal underdog into a live pick.`,
    );
  }
  if (underdogRecord.playIn) {
    addSignal(
      upsetSignals,
      "First Four carryover",
      "underdog",
      "Play-in",
      0.33,
      `${underdogTeam.name} would arrive from the First Four with game-speed reps already banked, even if depth and rest become tradeoffs.`,
    );
  }
  if (seedGap <= 2) {
    addSignal(
      upsetSignals,
      "Thin seed gap",
      "underdog",
      `${seedGap}`,
      0.32 + (3 - seedGap) * 0.08,
      `A narrow seed gap compresses the favorite's margin for error and keeps the underdog in range longer.`,
    );
  }

  editorialNotes.push({
    tag: "seed-history",
    summary:
      historicalSampleSize > 0
        ? `${historicalSampleSize} historical ${favoriteTeam.seed}-${underdogTeam.seed} first-round games are in the analog pool, with upsets in ${Math.round(historicalUpsetRate * 100)}% of them.`
        : `The exact seed line has limited history in the loaded corpus, so the page leans more on gap-based analogs than exact-pair priors.`,
    confidence: historicalSampleSize > 0 ? 0.74 : 0.48,
    sources: [kaggleSource],
  });

  if (conferenceGap > 0.5) {
    editorialNotes.push({
      tag: "conference-context",
      summary: `${favoriteTeam.name} played out of the stronger league bucket, which usually makes the favorite case sturdier than raw records alone suggest.`,
      confidence: 0.6,
      sources: [kaggleSource, tournamentFieldSource],
    });
  } else {
    editorialNotes.push({
      tag: "conference-context",
      summary: `${favoriteTeam.name} and ${underdogTeam.name} come from conference contexts that are close enough to leave more room for matchup variance than conference prestige narratives usually imply.`,
      confidence: 0.54,
      sources: [kaggleSource, tournamentFieldSource],
    });
  }

  if (underdogRecord.wins >= 27 || Math.abs(winPctGap) <= 0.045) {
    editorialNotes.push({
      tag: "form",
      summary: `${underdogTeam.name} enters with enough season-long win equity to make the upset case more structural than speculative.`,
      confidence: 0.58,
      sources: [tournamentFieldSource],
    });
  }

  if (underdogRecord.playIn) {
    editorialNotes.push({
      tag: "play-in",
      summary: `${underdogTeam.name} carries a First Four pathway, which can sharpen readiness while adding fatigue risk.`,
      confidence: 0.49,
      sources: [tournamentFieldSource],
    });
  }

  tags.splice(4);
  topSignals.sort(sortSignal);
  upsetSignals.sort(sortSignal);
  editorialNotes.splice(4);

  return {
    tags,
    topSignals: topSignals.slice(0, 4),
    upsetSignals: upsetSignals.slice(0, 4),
    editorialNotes,
  };
}

function buildComparisonRows(
  favoriteTeam: TeamSeed,
  underdogTeam: TeamSeed,
  favoriteRecord: RecordSummary,
  underdogRecord: RecordSummary,
  historicalUpsetRate: number,
  historicalSampleSize: number,
  favoriteWinProbability: number,
): MatchupComparisonRow[] {
  const favoriteConferenceTier = conferenceTier(favoriteTeam.conference);
  const underdogConferenceTier = conferenceTier(underdogTeam.conference);
  const favoriteHoldRate = 1 - historicalUpsetRate;
  const recordGap = favoriteRecord.winPct - underdogRecord.winPct;
  const conferenceGap = favoriteConferenceTier - underdogConferenceTier;

  return [
    {
      label: "Seed",
      favoriteValue: `${favoriteTeam.seed}`,
      underdogValue: `${underdogTeam.seed}`,
      lean: "favorite",
      rationale: "Lower seeds historically control the opening-round baseline unless the rest of the matchup shrinks that gap.",
    },
    {
      label: "Record",
      favoriteValue: favoriteTeam.record,
      underdogValue: underdogTeam.record,
      lean: Math.abs(recordGap) <= 0.03 ? "neutral" : recordGap > 0 ? "favorite" : "underdog",
      rationale:
        Math.abs(recordGap) <= 0.03
          ? "The record gap is thin enough that historical underdogs in this band often stay live deep into the game."
          : recordGap > 0
            ? "A materially better record usually reinforces the favorite path in comparable first-round games."
            : "The underdog's stronger record profile is exactly the kind of mismatch that has foreshadowed prior bracket misses.",
    },
    {
      label: "Win percentage",
      favoriteValue: percent(favoriteRecord.winPct),
      underdogValue: percent(underdogRecord.winPct),
      lean: Math.abs(recordGap) <= 0.035 ? "underdog" : recordGap > 0 ? "favorite" : "underdog",
      rationale:
        Math.abs(recordGap) <= 0.035
          ? "Near-parity win rates are one of the cleaner historical signs that the seed line may overstate the favorite."
          : recordGap > 0
            ? "The favorite built a more reliable season-long win profile."
            : "The underdog actually outperformed the favorite over the full season, which is a strong upset-era pattern.",
    },
    {
      label: "Conference tier",
      favoriteValue: favoriteConferenceTier.toFixed(1),
      underdogValue: underdogConferenceTier.toFixed(1),
      lean: Math.abs(conferenceGap) <= 0.4 ? "neutral" : conferenceGap > 0 ? "favorite" : "underdog",
      rationale:
        Math.abs(conferenceGap) <= 0.4
          ? "Conference context is close enough here that it does not strongly separate the teams."
          : conferenceGap > 0
            ? "The favorite's stronger league context has historically made similar favorites more durable."
            : "The underdog's league context is stronger than its seed suggests, which is a known upset flag.",
    },
    {
      label: "Historical seed-line results",
      favoriteValue: `${Math.round(favoriteHoldRate * 100)}% hold`,
      underdogValue: `${Math.round(historicalUpsetRate * 100)}% upset`,
      lean: historicalUpsetRate >= 0.26 ? "underdog" : "favorite",
      rationale:
        historicalSampleSize > 0
          ? `${historicalSampleSize} prior games from this seed band are in the analog pool, so this row is grounded in actual tournament outcomes.`
          : "Exact analogs are thin, so this row falls back to the broader seed-gap history."
    },
    {
      label: "Model baseline",
      favoriteValue: percent(favoriteWinProbability),
      underdogValue: percent(1 - favoriteWinProbability),
      lean: favoriteWinProbability >= 0.67 ? "favorite" : favoriteWinProbability <= 0.55 ? "underdog" : "neutral",
      rationale:
        favoriteWinProbability >= 0.67
          ? "The synthesized historical model still gives the favorite real breathing room."
          : favoriteWinProbability <= 0.55
            ? "The model sees this as much closer to a toss-up than the seed numbers imply."
            : "The baseline leaves enough uncertainty that secondary matchup texture matters more than usual.",
    },
  ];
}

function buildStatComparisonRows(
  favoriteProfile: ExtendedTeamSeasonProfile | undefined,
  underdogProfile: ExtendedTeamSeasonProfile | undefined,
): MatchupComparisonRow[] {
  if (!favoriteProfile || !underdogProfile) {
    return [];
  }

  const rows: Array<{
    label: string;
    favoriteValue: string;
    underdogValue: string;
    favoriteMetric: number;
    underdogMetric: number;
    lowerIsBetter?: boolean;
    underdogVarianceAngle?: boolean;
    rationale: string;
  }> = [
    {
      label: "Offensive efficiency",
      favoriteValue: favoriteProfile.offRating.toFixed(1),
      underdogValue: underdogProfile.offRating.toFixed(1),
      favoriteMetric: favoriteProfile.offRating,
      underdogMetric: underdogProfile.offRating,
      rationale: "Higher offensive efficiency usually maps to cleaner scoring possessions against tournament defenses.",
    },
    {
      label: "Defensive efficiency",
      favoriteValue: favoriteProfile.defRating.toFixed(1),
      underdogValue: underdogProfile.defRating.toFixed(1),
      favoriteMetric: favoriteProfile.defRating,
      underdogMetric: underdogProfile.defRating,
      lowerIsBetter: true,
      rationale: "Lower defensive efficiency means fewer points allowed per 100 possessions, which tends to travel well in tournament games.",
    },
    {
      label: "Net rating",
      favoriteValue: favoriteProfile.netRating.toFixed(1),
      underdogValue: underdogProfile.netRating.toFixed(1),
      favoriteMetric: favoriteProfile.netRating,
      underdogMetric: underdogProfile.netRating,
      rationale: "Net rating is the fastest shorthand for whether a team consistently wins the possession battle.",
    },
    {
      label: "3-point rate",
      favoriteValue: percent(favoriteProfile.threeRate),
      underdogValue: percent(underdogProfile.threeRate),
      favoriteMetric: favoriteProfile.threeRate,
      underdogMetric: underdogProfile.threeRate,
      underdogVarianceAngle: true,
      rationale: "A higher 3-point rate raises variance. That can help favorites stretch leads, but it is also one of the classic ways underdogs stay live.",
    },
    {
      label: "Turnover rate",
      favoriteValue: percent(favoriteProfile.turnoverRate),
      underdogValue: percent(underdogProfile.turnoverRate),
      favoriteMetric: favoriteProfile.turnoverRate,
      underdogMetric: underdogProfile.turnoverRate,
      lowerIsBetter: true,
      rationale: "Lower turnover rates matter because they preserve possessions and limit the self-inflicted runs that swing tournament games.",
    },
    {
      label: "Offensive rebound rate",
      favoriteValue: percent(favoriteProfile.offensiveReboundRate),
      underdogValue: percent(underdogProfile.offensiveReboundRate),
      favoriteMetric: favoriteProfile.offensiveReboundRate,
      underdogMetric: underdogProfile.offensiveReboundRate,
      rationale: "Second-chance offense is one of the cleaner ways to outperform a seed line in March.",
    },
    {
      label: "Free throw rate",
      favoriteValue: percent(favoriteProfile.ftaRate),
      underdogValue: percent(underdogProfile.ftaRate),
      favoriteMetric: favoriteProfile.ftaRate,
      underdogMetric: underdogProfile.ftaRate,
      rationale: "Higher free throw rate usually means a team can create stable points even when jump shots flatten out.",
    },
    {
      label: "Recent net rating",
      favoriteValue: favoriteProfile.recentNetRating?.toFixed(1) ?? "n/a",
      underdogValue: underdogProfile.recentNetRating?.toFixed(1) ?? "n/a",
      favoriteMetric: favoriteProfile.recentNetRating ?? favoriteProfile.netRating,
      underdogMetric: underdogProfile.recentNetRating ?? underdogProfile.netRating,
      rationale: "Recent net rating is the quickest check for whether the season-long profile still matches how the team closed.",
    },
  ];

  return rows.map((row) => {
    let lean: MatchupComparisonRow["lean"];
    if (row.underdogVarianceAngle && row.underdogMetric > row.favoriteMetric + 0.03) {
      lean = "underdog";
    } else if (row.lowerIsBetter) {
      lean =
        Math.abs(row.favoriteMetric - row.underdogMetric) <= 0.015
          ? "neutral"
          : row.favoriteMetric < row.underdogMetric
            ? "favorite"
            : "underdog";
    } else {
      lean =
        Math.abs(row.favoriteMetric - row.underdogMetric) <= 0.015
          ? "neutral"
          : row.favoriteMetric > row.underdogMetric
            ? "favorite"
            : "underdog";
    }

    return {
      label: row.label,
      favoriteValue: row.favoriteValue,
      underdogValue: row.underdogValue,
      lean,
      rationale: row.rationale,
    };
  });
}

function slotRoundLabel(round: number): string {
  switch (round) {
    case 1:
      return "Round of 64";
    case 2:
      return "Round of 32";
    case 3:
      return "Sweet 16";
    case 4:
      return "Elite Eight";
    case 5:
      return "Final Four";
    case 6:
      return "National Championship";
    default:
      return `Round ${round}`;
  }
}

function teamSelectionKey(team: TeamSeed): string {
  return `${team.seed}-${team.name}`;
}

function buildProjectedMatchup(
  slotId: string,
  region: string,
  round: string,
  roundNumber: number,
  slotLabel: string,
  topTeam: TeamSeed,
  bottomTeam: TeamSeed,
): ProjectedBracketGame {
  const favorite = topTeam.seed <= bottomTeam.seed ? topTeam : bottomTeam;
  const underdog = favorite === topTeam ? bottomTeam : topTeam;
  const favoriteRecord = parseRecord(favorite.record);
  const underdogRecord = parseRecord(underdog.record);
  const favoriteProfile = teamProfileFor(favorite.name);
  const underdogProfile = teamProfileFor(underdog.name);
  const favoriteCurrentStats = currentTeamStatsFor(favorite.name);
  const underdogCurrentStats = currentTeamStatsFor(underdog.name);
  const currentStatComparisonRows = buildCurrentStatComparisonRows(
    favorite.name,
    underdog.name,
    favoriteCurrentStats,
    underdogCurrentStats,
  );
  const historicalStatComparisonRows = buildStatComparisonRows(favoriteProfile, underdogProfile);
  const statComparisonRows = currentStatComparisonRows.length > 0 ? currentStatComparisonRows : historicalStatComparisonRows;
  const favoriteLiveEdges = currentStatComparisonRows.filter((row) => row.lean === "favorite").length;
  const underdogLiveEdges = currentStatComparisonRows.filter((row) => row.lean === "underdog").length;
  const statEdgeScore = favoriteLiveEdges - underdogLiveEdges;
  const statConflict = currentStatComparisonRows.length > 0 && Math.abs(statEdgeScore) <= 1;
  const seedGap = underdog.seed - favorite.seed;
  const seedKey = `${favorite.seed}-${underdog.seed}`;
  const roundSeedKey = `${round}:${seedKey}`;
  const roundGapKey = `${round}:${seedGap}`;
  const exactAnalogs = gamesByRoundSeed.get(roundSeedKey) ?? [];
  const gapAnalogs = gamesByRoundGap.get(roundGapKey) ?? [];
  const allRoundSeedAnalogs = gamesBySeed.get(seedKey) ?? [];
  const allRoundGapAnalogs = gamesByGap.get(seedGap) ?? [];
  const analogPool =
    exactAnalogs.length >= 4
      ? exactAnalogs
      : exactAnalogs.length > 0
        ? [...exactAnalogs, ...gapAnalogs, ...allRoundSeedAnalogs]
        : gapAnalogs.length > 0
          ? [...gapAnalogs, ...allRoundSeedAnalogs]
          : allRoundSeedAnalogs.length > 0
            ? [...allRoundSeedAnalogs, ...allRoundGapAnalogs]
            : allRoundGapAnalogs;
  const uniqueAnalogPool = [...new Map(analogPool.map((game) => [game.gameId, game])).values()];
  const historicalUpsetRate =
    uniqueAnalogPool.length > 0
      ? uniqueAnalogPool.filter((game) => game.seedUpset).length / uniqueAnalogPool.length
      : clamp(0.12 + Math.max(0, 7 - seedGap) * 0.028, 0.04, 0.48);
  const favoriteConferenceTier = conferenceTier(favorite.conference);
  const underdogConferenceTier = conferenceTier(underdog.conference);
  const conferenceGap = favoriteConferenceTier - underdogConferenceTier;
  const winPctGap = favoriteRecord.winPct - underdogRecord.winPct;
  const seedHistoryFavoriteProb =
    uniqueAnalogPool.length > 0
      ? average(uniqueAnalogPool.map((game) => game.favoriteWinProbability || (game.seedUpset ? 0 : 1)))
      : clamp(0.5 + seedGap * 0.045, 0.52, 0.93);
  const classicTrap = classicUpsetTag(favorite.seed, underdog.seed) !== null;
  const currentStatSignals = buildCurrentStatSignals(favorite, underdog, favoriteCurrentStats, underdogCurrentStats);

  const favoriteWinProbability = clamp(
    seedHistoryFavoriteProb
      + clamp(winPctGap * 0.22, -0.08, 0.08)
      + clamp(conferenceGap * 0.025, -0.06, 0.06)
      + clamp(statEdgeScore * 0.012, -0.06, 0.06)
      + (favoriteRecord.wins >= 28 ? 0.02 : 0)
      - (underdogRecord.wins >= 27 ? 0.03 : 0)
      - (classicTrap ? 0.03 : 0)
      - (underdogRecord.playIn ? 0.015 : 0)
      + currentStatSignals.probabilityDelta,
    0.12,
    0.95,
  );
  const upsetLikelihood = clamp(1 - favoriteWinProbability, 0.05, 0.88);
  const volatility = clamp(
    0.28
      + historicalUpsetRate * 0.55
      + (seedGap <= 2 ? 0.16 : seedGap <= 4 ? 0.08 : 0.03)
      + (Math.abs(winPctGap) <= 0.045 ? 0.08 : 0)
      + (classicTrap ? 0.08 : 0)
      + (underdogRecord.playIn ? 0.04 : 0)
      + (statConflict ? 0.05 : 0)
      + (currentStatComparisonRows.length > 0 && underdogLiveEdges > favoriteLiveEdges ? 0.02 : 0)
      + currentStatSignals.volatilityDelta,
    0.24,
    0.9,
  );
  const confidence = clamp(
    0.44
      + Math.min(uniqueAnalogPool.length, 24) / 100
      + Math.abs(favoriteWinProbability - 0.5) * 0.7
      + (currentStatComparisonRows.length > 0 ? 0.05 : 0)
      + (currentStatComparisonRows.length > 0 && Math.abs(statEdgeScore) >= 3 ? 0.02 : 0),
    0.42,
    0.9,
  );

  const { tags, topSignals, upsetSignals, editorialNotes } = buildTeamSignals(
    favorite,
    underdog,
    favoriteRecord,
    underdogRecord,
    favoriteWinProbability,
    upsetLikelihood,
    historicalUpsetRate,
    uniqueAnalogPool.length,
  );

  topSignals.push(...currentStatSignals.favoriteSignals);
  upsetSignals.push(...currentStatSignals.upsetSignals);
  editorialNotes.push(...currentStatSignals.editorialNotes);

  if (currentStatComparisonRows.length > 0) {
    editorialNotes.unshift({
      tag: "current-season-stats",
      summary: `${currentTeamStatsSnapshot.updated}. This projection uses live NCAA team stats for scoring, shooting, and possession control instead of leaning only on historical analogs.`,
      confidence: 0.78,
      sources: [ncaaCurrentStatsSource],
    });

    if (favorite.name.includes("/") || underdog.name.includes("/")) {
      editorialNotes.unshift({
        tag: "play-in-context",
        summary:
          "This projected game still contains a First Four slot, so the current-season stat table blends the live numbers of the possible entrants until the play-in winner is fixed.",
        confidence: 0.44,
        sources: [tournamentFieldSource, ncaaCurrentStatsSource],
      });
    }

    if (favoriteLiveEdges >= underdogLiveEdges + 2) {
      topSignals.push({
        label: "Current-season category edge",
        direction: "favorite",
        value: `${favoriteLiveEdges}-${underdogLiveEdges}`,
        strength: clamp(0.44 + favoriteLiveEdges * 0.05, 0.44, 0.82),
        detail: `${favorite.name} wins more live NCAA stat categories across scoring, shooting, and possession-control traits.`,
      });
    }
    if (underdogLiveEdges >= favoriteLiveEdges + 2) {
      upsetSignals.push({
        label: "Current-season category edge",
        direction: "underdog",
        value: `${underdogLiveEdges}-${favoriteLiveEdges}`,
        strength: clamp(0.44 + underdogLiveEdges * 0.05, 0.44, 0.82),
        detail: `${underdog.name} actually wins more live NCAA stat categories than the seed line would normally imply.`,
      });
    }
  }

  topSignals.sort(sortSignal);
  upsetSignals.sort(sortSignal);
  topSignals.splice(4);
  upsetSignals.splice(4);
  editorialNotes.splice(4);

  const analogs = uniqueAnalogPool
    .map((game) => ({
      game,
      distance:
        Math.abs(game.upsetLikelihood - upsetLikelihood) * 3 +
        Math.abs(game.volatility - volatility) * 1.8 +
        Math.abs(game.seedGap - seedGap) * 0.4 +
        (game.round === round ? -0.2 : 0) +
        (classicTrap && game.seedUpset ? -0.15 : 0),
    }))
    .sort((left, right) => left.distance - right.distance || right.game.season - left.game.season)
    .slice(0, 4)
    .map((entry) => entry.game);

  const favoriteLiveStatNarrative =
    currentStatComparisonRows.length === 0
      ? ""
      : favoriteLiveEdges > underdogLiveEdges
        ? ` The live 2026 NCAA stat snapshot also tilts toward ${favorite.name}.`
        : underdogLiveEdges > favoriteLiveEdges
          ? ` The live 2026 NCAA stat snapshot is less comfortable for ${favorite.name}, with ${underdog.name} winning more tracked categories.`
          : " The live 2026 NCAA stat snapshot comes in mixed rather than one-sided.";
  const underdogLiveStatNarrative =
    currentStatComparisonRows.length === 0
      ? ""
      : underdogLiveEdges > favoriteLiveEdges
        ? ` ${underdog.name} also wins more live NCAA stat categories than the bracket line implies.`
        : favoriteLiveEdges > underdogLiveEdges
          ? ` The underdog needs to outrun a live statistical deficit, not just a seed deficit.`
          : " The live NCAA stat profile is mixed enough to keep the upset case from being purely narrative.";

  const favoriteCaseSummary = `${favorite.name} owns the cleaner bracket case through the ${favorite.seed}-${underdog.seed} seed structure${winPctGap > 0.02 ? ", stronger record profile," : ""}${conferenceGap > 0.5 ? " and tougher schedule context." : "."}${favoriteLiveStatNarrative}`;
  const underdogCaseSummary = `${underdog.name} stays live because ${historicalUpsetRate >= 0.2 ? "this seed line already produces misses" : "the favorite's cushion is not overwhelming"}${underdogRecord.wins >= 27 ? ", the underdog has real win volume," : ""}${Math.abs(winPctGap) <= 0.045 ? " and the record gap is thinner than the seeding suggests." : "."}${underdogLiveStatNarrative}`;
  const modelMissSummary =
    upsetLikelihood >= 0.35
      ? `If ${favorite.name} loses, the miss would most likely come from treating seed-line hierarchy as more stable than the combination of analog history, record parity, and live current-season matchup stats.`
      : `If ${favorite.name} loses, the surprise would likely come from game-level variance outrunning both a stable seed profile and the current statistical baseline.`;

  const quantitativeHighlights = uniqueStrings([
    `Seed line ${favorite.seed}-${underdog.seed}`,
    `Historical upset rate ${percent(historicalUpsetRate)}`,
    `Historical sample ${uniqueAnalogPool.length} games`,
    `Favorite win probability ${percent(favoriteWinProbability)}`,
    `Upset likelihood ${percent(upsetLikelihood)}`,
    `Volatility ${percent(volatility)}`,
    `Confidence ${percent(confidence)}`,
    `Record gap ${(winPctGap * 100).toFixed(1)} pts`,
    `Conference tier gap ${conferenceGap.toFixed(1)}`,
    ...topSignals.slice(0, 2).map(signalSummary),
    ...upsetSignals.slice(0, 2).map(signalSummary),
  ]);

  if (currentStatComparisonRows.length > 0) {
    quantitativeHighlights.push(
      `Live NCAA snapshot ${currentTeamStatsSnapshot.updated}`,
      ...currentStatComparisonRows.slice(0, 5).map((row) => `${row.label}: ${row.favoriteValue} vs ${row.underdogValue}`),
    );
  } else if (historicalStatComparisonRows.length > 0) {
    quantitativeHighlights.push(
      `Latest team-profile season ${latestProfileSeason}`,
      ...historicalStatComparisonRows.slice(0, 4).map((row) => `${row.label}: ${row.favoriteValue} vs ${row.underdogValue}`),
    );
  }

  const qualitativeHighlights = uniqueStrings([
    ...editorialNotes.map(noteSummary),
    ...tags.map((tag) => tag.label),
  ]);
  const comparisonRows = buildComparisonRows(
    favorite,
    underdog,
    favoriteRecord,
    underdogRecord,
    historicalUpsetRate,
    uniqueAnalogPool.length,
    favoriteWinProbability,
  );
  const analysisSections: HistoricalAnalysisSection[] = [
    {
      title: "Why the favorite is favored",
      summary: favoriteCaseSummary,
      highlights: topSignals.map(signalSummary),
      tone: "favorite",
    },
    {
      title: "Why the underdog is live",
      summary: underdogCaseSummary,
      highlights: upsetSignals.map(signalSummary),
      tone: "underdog",
    },
    {
      title: "What the historical analogs say",
      summary:
        analogs.length > 0
          ? `${analogs.length} prior ${round} games in the corpus rhyme with this matchup's seed line and volatility profile.`
          : "The page falls back to broader seed-gap history because exact analogs are thin.",
      highlights:
        analogs.length > 0
          ? analogs.map((analog) => `${analog.season} ${analog.round} - ${analog.underdog} over ${analog.favorite}`)
          : [`Historical upset rate on this seed line: ${percent(historicalUpsetRate)}`],
      tone: "neutral",
    },
    {
      title: "What would break the model",
      summary: modelMissSummary,
      highlights: editorialNotes.map(noteSummary),
      tone: "neutral",
    },
  ];

  const summary =
    upsetLikelihood >= 0.4
      ? `${underdog.name} is a serious live underdog: the historical seed profile is unstable enough, and the favorite's edge is not wide enough, to keep the upset case active into the late possessions.`
      : upsetLikelihood >= 0.3
        ? `${favorite.name} is still the likelier winner, but ${underdog.name} has a real upset lane once the analog history, live stat snapshot, and record context are layered onto the bracket line.`
        : `${favorite.name} has the sturdier pregame profile, and the upset case relies more on variance than on a broad pregame edge.`;

  const projectedWinner = favoriteWinProbability >= 0.5 ? favorite : underdog;
  const projectedLoser = projectedWinner === favorite ? underdog : favorite;

  return {
    id: slotId,
    slotId,
    slotLabel,
    round,
    roundNumber,
    region,
    topTeam,
    bottomTeam,
    upsetCandidate:
      upsetLikelihood >= 0.33 ||
      (classicTrap && volatility >= 0.56) ||
      (underdogRecord.wins >= 27 && favoriteWinProbability < 0.7),
    favoriteWinProbability,
    upsetLikelihood,
    volatility,
    confidence,
    historicalUpsetRate,
    historicalSampleSize: uniqueAnalogPool.length,
    favoriteTeam: favorite.name,
    underdogTeam: underdog.name,
    summary,
    favoriteCaseSummary,
    underdogCaseSummary,
    modelMissSummary,
    topSignals,
    upsetSignals,
    editorialNotes,
    sourceProvenance: currentStatComparisonRows.length > 0
      ? [tournamentFieldSource, kaggleSource, ncaaCurrentStatsSource]
      : [tournamentFieldSource, kaggleSource],
    quantitativeHighlights,
    qualitativeHighlights,
    analysisSections,
    comparisonRows,
    statComparisonRows,
    statProfileSeason: currentStatComparisonRows.length === 0 && historicalStatComparisonRows.length > 0 ? latestProfileSeason : undefined,
    statSnapshotUpdated: currentStatComparisonRows.length > 0 ? currentTeamStatsSnapshot.updated : undefined,
    historicalAnalogs: analogs.map((analog) => analog.gameId),
    tags,
    projectedWinner,
    projectedLoser,
    projectedWinnerProbability: projectedWinner === favorite ? favoriteWinProbability : upsetLikelihood,
    upsetPick: projectedWinner === underdog,
  };
}

function buildTournament2026Matchups(): MatchupPreview[] {
  const roundOneSlots = regionBrackets.flatMap((region) => region.slots.filter((slot) => slot.round === 1));
  const matchups: MatchupPreview[] = [];

  for (const slot of roundOneSlots) {
    const topTeam = slot.topTeam ? hydrateTeamSeedRecord(slot.topTeam) : undefined;
    const bottomTeam = slot.bottomTeam ? hydrateTeamSeedRecord(slot.bottomTeam) : undefined;
    if (!topTeam || !bottomTeam) {
      continue;
    }

    const favorite = topTeam.seed <= bottomTeam.seed ? topTeam : bottomTeam;
    const underdog = favorite === topTeam ? bottomTeam : topTeam;
    const favoriteRecord = parseRecord(favorite.record);
    const underdogRecord = parseRecord(underdog.record);
    const favoriteProfile = teamProfileFor(favorite.name);
    const underdogProfile = teamProfileFor(underdog.name);
    const favoriteCurrentStats = currentTeamStatsFor(favorite.name);
    const underdogCurrentStats = currentTeamStatsFor(underdog.name);
    const currentStatComparisonRows = buildCurrentStatComparisonRows(
      favorite.name,
      underdog.name,
      favoriteCurrentStats,
      underdogCurrentStats,
    );
    const historicalStatComparisonRows = buildStatComparisonRows(favoriteProfile, underdogProfile);
    const statComparisonRows = currentStatComparisonRows.length > 0 ? currentStatComparisonRows : historicalStatComparisonRows;
    const favoriteLiveEdges = currentStatComparisonRows.filter((row) => row.lean === "favorite").length;
    const underdogLiveEdges = currentStatComparisonRows.filter((row) => row.lean === "underdog").length;
    const statEdgeScore = favoriteLiveEdges - underdogLiveEdges;
    const statConflict = currentStatComparisonRows.length > 0 && Math.abs(statEdgeScore) <= 1;
    const seedGap = underdog.seed - favorite.seed;
    const seedKey = `${favorite.seed}-${underdog.seed}`;
    const exactAnalogs = roundOf64BySeed.get(seedKey) ?? [];
    const gapAnalogs = roundOf64ByGap.get(seedGap) ?? [];
    const analogPool = exactAnalogs.length >= 4 ? exactAnalogs : exactAnalogs.length > 0 ? [...exactAnalogs, ...gapAnalogs] : gapAnalogs;
    const uniqueAnalogPool = [...new Map(analogPool.map((game) => [game.gameId, game])).values()];
    const historicalUpsetRate =
      uniqueAnalogPool.length > 0
        ? uniqueAnalogPool.filter((game) => game.seedUpset).length / uniqueAnalogPool.length
        : clamp(0.12 + Math.max(0, 7 - seedGap) * 0.028, 0.04, 0.48);
    const favoriteConferenceTier = conferenceTier(favorite.conference);
    const underdogConferenceTier = conferenceTier(underdog.conference);
    const conferenceGap = favoriteConferenceTier - underdogConferenceTier;
    const winPctGap = favoriteRecord.winPct - underdogRecord.winPct;
    const seedHistoryFavoriteProb =
      uniqueAnalogPool.length > 0
        ? average(uniqueAnalogPool.map((game) => game.favoriteWinProbability || (game.seedUpset ? 0 : 1)))
        : clamp(0.5 + seedGap * 0.045, 0.52, 0.93);
    const classicTrap = classicUpsetTag(favorite.seed, underdog.seed) !== null;
    const currentStatSignals = buildCurrentStatSignals(favorite, underdog, favoriteCurrentStats, underdogCurrentStats);

    const favoriteWinProbability = clamp(
      seedHistoryFavoriteProb
        + clamp(winPctGap * 0.22, -0.08, 0.08)
        + clamp(conferenceGap * 0.025, -0.06, 0.06)
        + clamp(statEdgeScore * 0.012, -0.06, 0.06)
        + (favoriteRecord.wins >= 28 ? 0.02 : 0)
        - (underdogRecord.wins >= 27 ? 0.03 : 0)
        - (classicTrap ? 0.03 : 0)
        - (underdogRecord.playIn ? 0.015 : 0)
        + currentStatSignals.probabilityDelta,
      0.12,
      0.95,
    );
    const upsetLikelihood = clamp(1 - favoriteWinProbability, 0.05, 0.88);
    const volatility = clamp(
      0.28
        + historicalUpsetRate * 0.55
        + (seedGap <= 2 ? 0.16 : seedGap <= 4 ? 0.08 : 0.03)
        + (Math.abs(winPctGap) <= 0.045 ? 0.08 : 0)
        + (classicTrap ? 0.08 : 0)
        + (underdogRecord.playIn ? 0.04 : 0)
        + (statConflict ? 0.05 : 0)
        + (currentStatComparisonRows.length > 0 && underdogLiveEdges > favoriteLiveEdges ? 0.02 : 0)
        + currentStatSignals.volatilityDelta,
      0.24,
      0.9,
    );
    const confidence = clamp(
      0.44
        + Math.min(uniqueAnalogPool.length, 24) / 100
        + Math.abs(favoriteWinProbability - 0.5) * 0.7
        + (currentStatComparisonRows.length > 0 ? 0.05 : 0)
        + (currentStatComparisonRows.length > 0 && Math.abs(statEdgeScore) >= 3 ? 0.02 : 0),
      0.42,
      0.9,
    );

    const { tags, topSignals, upsetSignals, editorialNotes } = buildTeamSignals(
      favorite,
      underdog,
      favoriteRecord,
      underdogRecord,
      favoriteWinProbability,
      upsetLikelihood,
      historicalUpsetRate,
      uniqueAnalogPool.length,
    );

    topSignals.push(...currentStatSignals.favoriteSignals);
    upsetSignals.push(...currentStatSignals.upsetSignals);
    editorialNotes.push(...currentStatSignals.editorialNotes);

    if (currentStatComparisonRows.length > 0) {
      editorialNotes.unshift({
        tag: "current-season-stats",
        summary: `${currentTeamStatsSnapshot.updated}. This matchup is backed by live NCAA team stats for scoring, shooting, and possession control rather than last season's profile alone.`,
        confidence: 0.78,
        sources: [ncaaCurrentStatsSource],
      });

      if (favorite.name.includes("/") || underdog.name.includes("/")) {
        editorialNotes.unshift({
          tag: "play-in-context",
          summary:
            "This matchup still includes a First Four slot, so the current-season stat table blends the live numbers of the possible entrants until the play-in winner is locked in.",
          confidence: 0.44,
          sources: [tournamentFieldSource, ncaaCurrentStatsSource],
        });
      }

      if (favoriteLiveEdges >= underdogLiveEdges + 2) {
        topSignals.push({
          label: "Current-season category edge",
          direction: "favorite",
          value: `${favoriteLiveEdges}-${underdogLiveEdges}`,
          strength: clamp(0.44 + favoriteLiveEdges * 0.05, 0.44, 0.82),
          detail: `${favorite.name} owns more live NCAA stat wins across scoring, shooting, and possession-control categories.`,
        });
      }
      if (underdogLiveEdges >= favoriteLiveEdges + 2) {
        upsetSignals.push({
          label: "Current-season category edge",
          direction: "underdog",
          value: `${underdogLiveEdges}-${favoriteLiveEdges}`,
          strength: clamp(0.44 + underdogLiveEdges * 0.05, 0.44, 0.82),
          detail: `${underdog.name} actually wins more live NCAA stat categories than the seed line would suggest.`,
        });
      }

      topSignals.sort(sortSignal);
      upsetSignals.sort(sortSignal);
      topSignals.splice(4);
      upsetSignals.splice(4);
      editorialNotes.splice(4);
    } else {
      topSignals.sort(sortSignal);
      upsetSignals.sort(sortSignal);
      topSignals.splice(4);
      upsetSignals.splice(4);
      editorialNotes.splice(4);
    }

    const analogs = uniqueAnalogPool
      .map((game) => ({
        game,
        distance:
          Math.abs(game.upsetLikelihood - upsetLikelihood) * 3 +
          Math.abs(game.volatility - volatility) * 1.8 +
          Math.abs(game.seedGap - seedGap) * 0.4 +
          (classicTrap && game.seedUpset ? -0.15 : 0),
      }))
      .sort((left, right) => left.distance - right.distance || right.game.season - left.game.season)
      .slice(0, 4)
      .map((entry) => entry.game);

    const favoriteLiveStatNarrative =
      currentStatComparisonRows.length === 0
        ? ""
        : favoriteLiveEdges > underdogLiveEdges
          ? ` The live 2026 NCAA stat snapshot also tilts toward ${favorite.name}.`
          : underdogLiveEdges > favoriteLiveEdges
            ? ` The live 2026 NCAA stat snapshot is less comfortable for ${favorite.name}, with ${underdog.name} winning more tracked categories.`
            : " The live 2026 NCAA stat snapshot comes in mixed rather than one-sided.";
    const underdogLiveStatNarrative =
      currentStatComparisonRows.length === 0
        ? ""
        : underdogLiveEdges > favoriteLiveEdges
          ? ` ${underdog.name} also wins more live NCAA stat categories than the bracket line implies.`
          : favoriteLiveEdges > underdogLiveEdges
            ? ` The underdog needs to outrun a live statistical deficit, not just a seed deficit.`
            : " The live NCAA stat profile is mixed enough to keep the upset case from being purely narrative.";

    const favoriteCaseSummary = `${favorite.name} owns the cleaner bracket case through the ${favorite.seed}-${underdog.seed} seed structure${winPctGap > 0.02 ? ", stronger record profile," : ""}${conferenceGap > 0.5 ? " and tougher schedule context." : "."}${favoriteLiveStatNarrative}`;
    const underdogCaseSummary = `${underdog.name} stays live because ${historicalUpsetRate >= 0.2 ? "this seed line already produces misses" : "the favorite's cushion is not overwhelming"}${underdogRecord.wins >= 27 ? ", the underdog has real win volume," : ""}${Math.abs(winPctGap) <= 0.045 ? " and the record gap is thinner than the seeding suggests." : "."}${underdogLiveStatNarrative}`;
    const modelMissSummary =
      upsetLikelihood >= 0.35
        ? `If ${favorite.name} loses, the miss would most likely come from treating seed-line hierarchy as more stable than the combination of analog history, record parity, and live current-season matchup stats.`
        : `If ${favorite.name} loses, the surprise would likely come from game-level variance outrunning both a stable seed profile and the current statistical baseline.`;

    const quantitativeHighlights = uniqueStrings([
      `Seed line ${favorite.seed}-${underdog.seed}`,
      `Historical upset rate ${percent(historicalUpsetRate)}`,
      `Historical sample ${uniqueAnalogPool.length} games`,
      `Favorite win probability ${percent(favoriteWinProbability)}`,
      `Upset likelihood ${percent(upsetLikelihood)}`,
      `Volatility ${percent(volatility)}`,
      `Confidence ${percent(confidence)}`,
      `Record gap ${(winPctGap * 100).toFixed(1)} pts`,
      `Conference tier gap ${conferenceGap.toFixed(1)}`,
      ...topSignals.slice(0, 2).map(signalSummary),
      ...upsetSignals.slice(0, 2).map(signalSummary),
    ]);

    const qualitativeHighlights = uniqueStrings([
      ...editorialNotes.map(noteSummary),
      ...tags.map((tag) => tag.label),
    ]);
    const comparisonRows = buildComparisonRows(
      favorite,
      underdog,
      favoriteRecord,
      underdogRecord,
      historicalUpsetRate,
      uniqueAnalogPool.length,
      favoriteWinProbability,
    );

    const analysisSections: HistoricalAnalysisSection[] = [
      {
        title: "Why the favorite is favored",
        summary: favoriteCaseSummary,
        highlights: topSignals.map(signalSummary),
        tone: "favorite",
      },
      {
        title: "Why the underdog is live",
        summary: underdogCaseSummary,
        highlights: upsetSignals.map(signalSummary),
        tone: "underdog",
      },
      {
        title: "What the historical analogs say",
        summary:
          analogs.length > 0
            ? `${analogs.length} prior Round of 64 games in the corpus rhyme with this matchup's seed line and volatility profile.`
            : "The page falls back to broader seed-gap history because exact analogs are thin.",
        highlights:
          analogs.length > 0
            ? analogs.map((analog) => `${analog.season} ${analog.round} - ${analog.underdog} over ${analog.favorite}`)
            : [`Historical upset rate on this seed line: ${percent(historicalUpsetRate)}`],
        tone: "neutral",
      },
      {
        title: "What would break the model",
        summary: modelMissSummary,
        highlights: editorialNotes.map(noteSummary),
        tone: "neutral",
      },
    ];

    const summary =
      upsetLikelihood >= 0.4
        ? `${underdog.name} is a serious live underdog: the historical seed profile is unstable enough, and the favorite's edge is not wide enough, to keep the upset case active into the late possessions.`
        : upsetLikelihood >= 0.3
          ? `${favorite.name} is still the likelier winner, but ${underdog.name} has a real upset lane once the analog history, live stat snapshot, and record context are layered onto the bracket line.`
          : `${favorite.name} has the sturdier first-round profile, and the upset case relies more on variance than on a broad pregame edge.`;

    if (currentStatComparisonRows.length > 0) {
      quantitativeHighlights.push(
        `Live NCAA snapshot ${currentTeamStatsSnapshot.updated}`,
        ...currentStatComparisonRows.slice(0, 5).map((row) => `${row.label}: ${row.favoriteValue} vs ${row.underdogValue}`),
      );
    } else if (historicalStatComparisonRows.length > 0) {
      quantitativeHighlights.push(
        `Latest team-profile season ${latestProfileSeason}`,
        ...historicalStatComparisonRows.slice(0, 4).map((row) => `${row.label}: ${row.favoriteValue} vs ${row.underdogValue}`),
      );
    }

    matchups.push({
      id: slot.id,
      region: slot.region,
      round: "Round of 64",
      topTeam,
      bottomTeam,
      upsetCandidate:
        upsetLikelihood >= 0.33 ||
        (classicTrap && volatility >= 0.56) ||
        (underdogRecord.wins >= 27 && favoriteWinProbability < 0.7),
      favoriteWinProbability,
      upsetLikelihood,
      volatility,
      confidence,
      historicalUpsetRate,
      historicalSampleSize: uniqueAnalogPool.length,
      favoriteTeam: favorite.name,
      underdogTeam: underdog.name,
      summary,
      favoriteCaseSummary,
      underdogCaseSummary,
      modelMissSummary,
      topSignals,
      upsetSignals,
      editorialNotes,
      sourceProvenance: currentStatComparisonRows.length > 0
        ? [tournamentFieldSource, kaggleSource, ncaaCurrentStatsSource]
        : [tournamentFieldSource, kaggleSource],
      quantitativeHighlights,
      qualitativeHighlights,
      analysisSections,
      comparisonRows,
      statComparisonRows,
      statProfileSeason: currentStatComparisonRows.length === 0 && historicalStatComparisonRows.length > 0 ? latestProfileSeason : undefined,
      statSnapshotUpdated: currentStatComparisonRows.length > 0 ? currentTeamStatsSnapshot.updated : undefined,
      historicalAnalogs: analogs.map((analog) => analog.gameId),
      tags,
    });
  }

  return matchups.sort((left, right) => right.upsetLikelihood - left.upsetLikelihood || right.volatility - left.volatility);
}

const tournament2026Matchups = buildTournament2026Matchups();
const allProjectionSlots = [...regionBrackets.flatMap((region) => region.slots), ...finalFourSlots];
const projectionSlotMap = new Map(allProjectionSlots.map((slot) => [slot.id, slot]));
const roundOnePreviewById = new Map(tournament2026Matchups.map((matchup) => [matchup.id, matchup]));

function getProjectionSlotTeams(slotId: string, state: BracketState): [TeamSeed | undefined, TeamSeed | undefined] {
  const slot = projectionSlotMap.get(slotId);
  if (!slot) {
    return [undefined, undefined];
  }
  if (slot.round === 1) {
    return [
      slot.topTeam ? hydrateTeamSeedRecord(slot.topTeam) : undefined,
      slot.bottomTeam ? hydrateTeamSeedRecord(slot.bottomTeam) : undefined,
    ];
  }
  if (!slot.children) {
    return [undefined, undefined];
  }
  const [leftChild, rightChild] = slot.children;
  return [getProjectedWinningTeam(leftChild, state), getProjectedWinningTeam(rightChild, state)];
}

function getProjectedWinningTeam(slotId: string, state: BracketState): TeamSeed | undefined {
  const slot = projectionSlotMap.get(slotId);
  if (!slot) {
    return undefined;
  }
  const [topTeam, bottomTeam] = getProjectionSlotTeams(slotId, state);
  const pick = state.picks[slotId];
  if (!pick) {
    return undefined;
  }
  if (topTeam && pick === teamSelectionKey(topTeam)) {
    return topTeam;
  }
  if (bottomTeam && pick === teamSelectionKey(bottomTeam)) {
    return bottomTeam;
  }
  return undefined;
}

type ProjectionMode = "baseline" | "v2";

function hydrateRoundOneProjection(
  slot: BracketSlot,
  topTeam: TeamSeed,
  bottomTeam: TeamSeed,
  roundOnePreview: MatchupPreview,
): ProjectedBracketGame {
  const projectedWinner =
    roundOnePreview.favoriteWinProbability >= 0.5
      ? roundOnePreview.favoriteTeam === topTeam.name
        ? topTeam
        : bottomTeam
      : roundOnePreview.underdogTeam === topTeam.name
        ? topTeam
        : bottomTeam;

  return {
    ...roundOnePreview,
    slotId: slot.id,
    slotLabel: slot.label,
    roundNumber: slot.round,
    projectedWinner,
    projectedLoser: projectedWinner.name === topTeam.name ? bottomTeam : topTeam,
    projectedWinnerProbability:
      projectedWinner.name === roundOnePreview.favoriteTeam
        ? roundOnePreview.favoriteWinProbability
        : roundOnePreview.upsetLikelihood,
    upsetPick: projectedWinner.name === roundOnePreview.underdogTeam,
  };
}

function shouldTakeUpsetV2(game: ProjectedBracketGame): boolean {
  if (game.upsetPick) {
    return true;
  }

  const underdogStatEdges = game.statComparisonRows.filter((row) => row.lean === "underdog").length;
  const favoriteStatEdges = game.statComparisonRows.filter((row) => row.lean === "favorite").length;
  const underdogSignalStrength = average(game.upsetSignals.map((signal) => signal.strength));
  const favoriteSignalStrength = average(game.topSignals.map((signal) => signal.strength));
  const classicUpsetWindow = game.tags.some((tag) =>
    ["12/5 trap", "Live 11-seed", "Coin-flip 7/10", "Historical upset lane"].includes(tag.label),
  );

  if (game.roundNumber === 1) {
    if (game.upsetLikelihood >= 0.5) {
      return true;
    }
    if (game.upsetLikelihood >= 0.4 && underdogStatEdges > favoriteStatEdges && classicUpsetWindow) {
      return true;
    }
    return game.upsetLikelihood >= 0.35 && underdogStatEdges >= favoriteStatEdges + 4 && classicUpsetWindow;
  }

  if (game.roundNumber === 2) {
    return game.upsetLikelihood >= 0.38 && underdogStatEdges >= favoriteStatEdges + 2 && underdogSignalStrength >= favoriteSignalStrength - 0.02;
  }

  return game.upsetLikelihood >= 0.36 && underdogStatEdges >= favoriteStatEdges + 3 && underdogSignalStrength >= favoriteSignalStrength;
}

function applyProjectionMode(game: ProjectedBracketGame, mode: ProjectionMode): ProjectedBracketGame {
  if (mode !== "v2" || !shouldTakeUpsetV2(game) || game.upsetPick) {
    return game;
  }

  const projectedWinner = game.underdogTeam === game.topTeam.name ? game.topTeam : game.bottomTeam;
  const projectedLoser = projectedWinner.name === game.topTeam.name ? game.bottomTeam : game.topTeam;

  return {
    ...game,
    summary: `${game.underdogTeam} becomes the Bracket Signal v2 pick. The favorite still carries the cleaner single-game baseline, but this matchup sits in the upset window where a bracket should spend some risk.`,
    underdogCaseSummary: `${game.underdogCaseSummary} Bracket Signal v2 converts that live underdog case into an actual upset pick here.`,
    editorialNotes: [
      {
        tag: "v2-upset-pass",
        summary:
          "Bracket Signal v2 is willing to spend a bracket upset here because the underdog sits in a real volatility pocket instead of needing a miracle outcome.",
        confidence: 0.68,
        sources: game.sourceProvenance,
      },
      ...game.editorialNotes,
    ].slice(0, 4),
    tags: [{ label: "V2 upset swing", tone: "alert" as const }, ...game.tags].slice(0, 4),
    projectedWinner,
    projectedLoser,
    projectedWinnerProbability: game.upsetLikelihood,
    upsetPick: true,
  };
}

function buildBracketSignalProjection(mode: ProjectionMode): BracketSignalProjection {
  const state: BracketState = {
    version: 1,
    picks: {},
    upsetWatchlist: [],
  };
  const games: ProjectedBracketGame[] = [];

  for (const slot of allProjectionSlots) {
    const [topTeam, bottomTeam] = getProjectionSlotTeams(slot.id, state);
    if (!topTeam || !bottomTeam) {
      continue;
    }

    const round = slotRoundLabel(slot.round);
    const roundOnePreview = slot.round === 1 ? roundOnePreviewById.get(slot.id) : undefined;
    const baselineProjection = roundOnePreview
      ? hydrateRoundOneProjection(slot, topTeam, bottomTeam, roundOnePreview)
      : buildProjectedMatchup(slot.id, slot.region, round, slot.round, slot.label, topTeam, bottomTeam);
    const projection = applyProjectionMode(baselineProjection, mode);

    state.picks[slot.id] = teamSelectionKey(projection.projectedWinner);
    games.push(projection);
  }

  return {
    state,
    games,
    champion: getProjectedWinningTeam("title-game", state),
  };
}

const bracketSignalProjection = buildBracketSignalProjection("baseline");
const bracketSignalProjectionV2 = buildBracketSignalProjection("v2");

export function getDataset(): Dataset {
  return dataset;
}

export function getGame(gameId: string): GameRecord | undefined {
  return gameMap.get(gameId);
}

export function getHistoricalUpsets(): GameRecord[] {
  return dataset.games
    .filter((game) => game.seedUpset)
    .sort((left, right) => right.season - left.season || right.seedGap - left.seedGap || right.upsetLikelihood - left.upsetLikelihood);
}

export function getHistoricalGames(): GameRecord[] {
  return [...dataset.games].sort((left, right) => right.season - left.season);
}

export function getTournament2026Matchups(): MatchupPreview[] {
  return tournament2026Matchups;
}

export function hydrateTeamSeed(team: TeamSeed | undefined): TeamSeed | undefined {
  return team ? hydrateTeamSeedRecord(team) : undefined;
}

export function getCandidatePreviews(): MatchupPreview[] {
  return tournament2026Matchups;
}

export function getTournament2026Matchup(matchupId: string): MatchupPreview | undefined {
  return tournament2026Matchups.find((matchup) => matchup.id === matchupId);
}

export function getBracketSignalProjection(mode: ProjectionMode = "baseline"): BracketSignalProjection {
  return mode === "v2" ? bracketSignalProjectionV2 : bracketSignalProjection;
}

export function getAnalogGames(preview: MatchupPreview): GameRecord[] {
  return getGamesByIds(preview.historicalAnalogs);
}

export function getHistoricalGameAnalysis(game: GameRecord): HistoricalGameAnalysis {
  const source = asHistoricalGame(game);
  const summary = source.analysis?.summary ?? source.analysisSummary ?? source.templateExplanation ?? buildFallbackOverview(game);
  const favoriteSummary = source.analysis?.favoriteSummary ?? source.favoriteSummary ?? buildFallbackFavoriteSummary(game);
  const upsetSummary = source.analysis?.upsetSummary ?? source.upsetSummary ?? buildFallbackUpsetSummary(game);
  const quantitativeHighlights = buildQuantitativeHighlights(game, source);
  const qualitativeHighlights = buildQualitativeHighlights(game, source);
  const sections = buildSections(game, source, summary);
  const analogs = getGamesByIds(game.historicalAnalogs);

  return {
    summary,
    favoriteSummary,
    upsetSummary,
    quantitativeHighlights,
    qualitativeHighlights,
    sections,
    analogs,
    noteCount: game.editorialNotes.length,
    sourceCount: countUniqueSources(game),
  };
}

export function getHistoricalGameSearchText(game: GameRecord): string {
  const source = asHistoricalGame(game);
  return uniqueStrings([
    game.gameId,
    String(game.season),
    game.round,
    game.winner,
    game.loser,
    game.favorite,
    game.underdog,
    game.templateExplanation,
    source.analysis?.summary,
    source.analysisSummary,
    source.favoriteSummary,
    source.upsetSummary,
    source.analysis?.favoriteSummary,
    source.analysis?.upsetSummary,
    ...(source.analysis?.quantitativeHighlights ?? []),
    ...(source.analysis?.qualitativeHighlights ?? []),
    ...(source.quantitativeHighlights ?? []),
    ...(source.qualitativeHighlights ?? []),
    ...game.topSignals.map(signalSummary),
    ...game.upsetSignals.map(signalSummary),
    ...game.editorialNotes.map(noteSummary),
    ...game.sourceProvenance.map(sourceSummary),
  ]).join(" ").toLowerCase();
}

export function getTopUpsetCandidates(): Array<MatchupPreview & { analogs: GameRecord[] }> {
  return tournament2026Matchups
    .filter((preview) => preview.upsetCandidate)
    .map((preview) => ({
      ...preview,
      analogs: getAnalogGames(preview),
    }))
    .sort((left, right) => right.upsetLikelihood - left.upsetLikelihood || right.volatility - left.volatility);
}
