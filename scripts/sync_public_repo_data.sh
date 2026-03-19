#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/data/raw/public-repo"
SOURCE_DIR="${1:-/tmp/march-madness-ml}"

if [ ! -d "$SOURCE_DIR/.git" ]; then
  git clone https://github.com/adeshpande3/March-Madness-ML "$SOURCE_DIR"
fi

mkdir -p "$TARGET/KaggleData" "$TARGET/RatingStats" "$TARGET/RegSeasonStats"

cp "$SOURCE_DIR/Data/KaggleData/Teams.csv" "$TARGET/KaggleData/Teams.csv"
cp "$SOURCE_DIR/Data/KaggleData/NCAATourneyCompactResults.csv" "$TARGET/KaggleData/NCAATourneyCompactResults.csv"
cp "$SOURCE_DIR/Data/KaggleData/NCAATourneySeeds.csv" "$TARGET/KaggleData/NCAATourneySeeds.csv"
cp -R "$SOURCE_DIR/Data/RatingStats/." "$TARGET/RatingStats/"
cp -R "$SOURCE_DIR/Data/RegSeasonStats/." "$TARGET/RegSeasonStats/"

printf 'Synced public March Madness source files into %s\n' "$TARGET"
