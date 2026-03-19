import { z } from "zod";

export const historicalAnalysisSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  tone: z.enum(["favorite", "underdog", "neutral"]).optional(),
});

export const historicalAnalysisSchema = z.object({
  summary: z.string().optional(),
  favoriteSummary: z.string().optional(),
  upsetSummary: z.string().optional(),
  quantitativeHighlights: z.array(z.string()).optional(),
  qualitativeHighlights: z.array(z.string()).optional(),
  sections: z.array(historicalAnalysisSectionSchema).optional(),
  analogSummary: z.string().optional(),
  modelMissSummary: z.string().optional(),
});

export const signalSchema = z.object({
  label: z.string(),
  direction: z.enum(["favorite", "underdog"]),
  value: z.string(),
  strength: z.number(),
  detail: z.string(),
});

export const sourceReferenceSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

export const editorialNoteSchema = z.object({
  tag: z.string(),
  summary: z.string(),
  confidence: z.number(),
  sources: z.array(sourceReferenceSchema),
});

export const gameRecordSchema = z.object({
  gameId: z.string(),
  season: z.number(),
  dateLabel: z.string(),
  round: z.string(),
  winnerTeamId: z.number(),
  loserTeamId: z.number(),
  winner: z.string(),
  loser: z.string(),
  winnerSeed: z.number(),
  loserSeed: z.number(),
  winnerScore: z.number(),
  loserScore: z.number(),
  favoriteTeamId: z.number(),
  favorite: z.string(),
  favoriteSeed: z.number(),
  underdogTeamId: z.number(),
  underdog: z.string(),
  underdogSeed: z.number(),
  favoriteWon: z.boolean(),
  seedUpset: z.boolean(),
  marketUpset: z.boolean().nullable(),
  modelUpset: z.boolean(),
  seedGap: z.number(),
  favoriteWinProbability: z.number(),
  upsetLikelihood: z.number(),
  volatility: z.number(),
  confidence: z.number(),
  topSignals: z.array(signalSchema),
  upsetSignals: z.array(signalSchema),
  templateExplanation: z.string(),
  editorialNotes: z.array(editorialNoteSchema),
  historicalAnalogs: z.array(z.string()),
  sourceProvenance: z.array(sourceReferenceSchema),
  analysis: historicalAnalysisSchema.optional(),
  analysisSummary: z.string().optional(),
  favoriteSummary: z.string().optional(),
  upsetSummary: z.string().optional(),
  quantitativeHighlights: z.array(z.string()).optional(),
  qualitativeHighlights: z.array(z.string()).optional(),
  analysisSections: z.array(historicalAnalysisSectionSchema).optional(),
  analogSummary: z.string().optional(),
  modelMissSummary: z.string().optional(),
}).passthrough();

export const datasetSchema = z.object({
  summary: z.object({
    games: z.number(),
    upsets: z.number(),
    seasons: z.array(z.number()),
    latestSeason: z.number(),
  }),
  games: z.array(gameRecordSchema),
  upsetCandidates: z.array(gameRecordSchema),
  teamProfiles: z.array(z.any()),
  generatedAt: z.string(),
}).passthrough();
