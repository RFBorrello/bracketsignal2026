export type Direction = "favorite" | "underdog";

export type Signal = {
  label: string;
  direction: Direction;
  value: string;
  strength: number;
  detail: string;
};

export type SourceReference = {
  label: string;
  url: string;
};

export type EditorialNote = {
  tag: string;
  summary: string;
  confidence: number;
  sources: SourceReference[];
};

export type HistoricalAnalysisSection = {
  title: string;
  summary: string;
  highlights: string[];
  tone?: Direction | "neutral";
};

export type HistoricalAnalysis = {
  summary?: string;
  favoriteSummary?: string;
  upsetSummary?: string;
  quantitativeHighlights?: string[];
  qualitativeHighlights?: string[];
  sections?: HistoricalAnalysisSection[];
  analogSummary?: string;
  modelMissSummary?: string;
};

export type GameRecord = {
  gameId: string;
  season: number;
  dateLabel: string;
  round: string;
  winnerTeamId: number;
  loserTeamId: number;
  winner: string;
  loser: string;
  winnerSeed: number;
  loserSeed: number;
  winnerScore: number;
  loserScore: number;
  favoriteTeamId: number;
  favorite: string;
  favoriteSeed: number;
  underdogTeamId: number;
  underdog: string;
  underdogSeed: number;
  favoriteWon: boolean;
  seedUpset: boolean;
  marketUpset: boolean | null;
  modelUpset: boolean;
  seedGap: number;
  favoriteWinProbability: number;
  upsetLikelihood: number;
  volatility: number;
  confidence: number;
  topSignals: Signal[];
  upsetSignals: Signal[];
  templateExplanation: string;
  editorialNotes: EditorialNote[];
  historicalAnalogs: string[];
  sourceProvenance: SourceReference[];
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

export type TeamSeasonProfile = {
  season: number;
  teamId: number;
  team: string;
  games: number;
  wins: number;
  winPct: number;
  offRating: number;
  defRating: number;
  netRating: number;
  threeRate: number;
  turnoverRate: number;
  offensiveReboundRate: number;
  ftaRate: number;
  ratingMean: number;
  ratingBest: number;
  systems: number;
  recentNetRating?: number;
  recentWinPct?: number;
  conference?: string;
  coach?: string;
};

export type DatasetSummary = {
  games: number;
  upsets: number;
  seasons: number[];
  latestSeason: number;
};

export type Dataset = {
  summary: DatasetSummary;
  games: GameRecord[];
  upsetCandidates: GameRecord[];
  teamProfiles: TeamSeasonProfile[];
  generatedAt: string;
};

export type HistoricalGameAnalysis = {
  summary: string;
  favoriteSummary: string;
  upsetSummary: string;
  quantitativeHighlights: string[];
  qualitativeHighlights: string[];
  sections: HistoricalAnalysisSection[];
  analogs: GameRecord[];
  noteCount: number;
  sourceCount: number;
};

export type TeamSeed = {
  name: string;
  seed: number;
  conference: string;
  record: string;
  note?: string;
};

export type BracketSlot = {
  id: string;
  round: number;
  region: string;
  label: string;
  topTeam?: TeamSeed;
  bottomTeam?: TeamSeed;
  children?: [string, string];
};

export type RegionBracket = {
  region: string;
  slots: BracketSlot[];
};

export type CandidateTag = {
  label: string;
  tone: "alert" | "favorite" | "neutral";
};

export type MatchupComparisonRow = {
  label: string;
  favoriteValue: string;
  underdogValue: string;
  lean: "favorite" | "underdog" | "neutral";
  rationale: string;
};

export type MatchupPreview = {
  id: string;
  region: string;
  round: string;
  topTeam: TeamSeed;
  bottomTeam: TeamSeed;
  upsetCandidate: boolean;
  favoriteWinProbability: number;
  upsetLikelihood: number;
  volatility: number;
  confidence: number;
  historicalUpsetRate: number;
  historicalSampleSize: number;
  favoriteTeam: string;
  underdogTeam: string;
  summary: string;
  favoriteCaseSummary: string;
  underdogCaseSummary: string;
  modelMissSummary?: string;
  topSignals: Signal[];
  upsetSignals: Signal[];
  editorialNotes: EditorialNote[];
  sourceProvenance: SourceReference[];
  quantitativeHighlights: string[];
  qualitativeHighlights: string[];
  analysisSections: HistoricalAnalysisSection[];
  comparisonRows: MatchupComparisonRow[];
  statComparisonRows: MatchupComparisonRow[];
  statProfileSeason?: number;
  statSnapshotUpdated?: string;
  historicalAnalogs: string[];
  tags: CandidateTag[];
};

export type ProjectedBracketGame = MatchupPreview & {
  slotId: string;
  slotLabel: string;
  roundNumber: number;
  projectedWinner: TeamSeed;
  projectedLoser: TeamSeed;
  projectedWinnerProbability: number;
  upsetPick: boolean;
};

export type BracketSignalProjection = {
  state: BracketState;
  games: ProjectedBracketGame[];
  champion?: TeamSeed;
};

export type BracketState = {
  version: number;
  picks: Record<string, string>;
  upsetWatchlist: string[];
};
