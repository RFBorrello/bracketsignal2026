# NCAA Model

Data-driven NCAA men's tournament analysis site and interactive bracket builder.

## Commands

```bash
npm install
npm run dev
python3.12 -m venv .venv-data
.venv-data/bin/python -m pip install -r scripts/requirements.txt
.venv-data/bin/python scripts/fetch_kaggle_data.py
.venv-data/bin/python scripts/build_dataset.py
```

On macOS, you can also double-click [Launch Bracket Signal.command](/Users/richie/pCloud%20Drive/Projects/ncaamodel/Launch%20Bracket%20Signal.command) to build the dataset, start the dev server, and open the site in your browser.

If the workspace filesystem does not support npm symlinks or native binary execution, install the toolchain under `/tmp` and run Next from there:

```bash
npm install --prefix /tmp/ncaamodel-node next@15.3.1 react@19.0.0 react-dom@19.0.0 zod@3.24.2 typescript@5.8.3 tsx@4.19.4 @types/node@22.15.30 @types/react@19.1.6 @types/react-dom@19.1.5
NODE_PATH=/tmp/ncaamodel-node/node_modules node /tmp/ncaamodel-node/node_modules/next/dist/bin/next dev
```

## Data Inputs

`scripts/build_dataset.py` supports two modes:

- Fallback starter mode: if no raw files are present, it preserves a checked-in starter dataset in `data/processed/dataset.json`.
- Full raw ingestion mode: place these public Kaggle-style CSVs in `data/raw/` and rerun the script:
  - `MTeams.csv`
  - `MNCAATourneySeeds.csv`
  - `MNCAATourneyDetailedResults.csv`
  - `MRegularSeasonDetailedResults.csv`
  - `MMasseyOrdinals.csv`

## Kaggle Path

Kaggle is a reasonable source for this project because the March Machine Learning Mania competition data includes the exact file family this ETL expects. For this repo:

1. Create a Kaggle account and generate an API token at [Kaggle Settings](https://www.kaggle.com/settings)
2. Save `kaggle.json` to `~/.kaggle/kaggle.json`
3. Install Python dependencies:

```bash
python3.12 -m venv .venv-data
.venv-data/bin/python -m pip install -r scripts/requirements.txt
```

The repo pins `kaggle==1.8.4` because Kaggle's newer API token system requires `kaggle >= 1.8.0`.

4. For newer Kaggle API tokens, store the raw token string at `~/.kaggle/access_token`.

5. Download the competition data:

```bash
.venv-data/bin/python scripts/fetch_kaggle_data.py
```

If the newer Kaggle token flow does not work through `kaggle.json`, use the `kagglehub` path instead:

```bash
.venv-data/bin/python scripts/fetch_kagglehub_data.py
```

6. Rebuild the processed dataset:

```bash
.venv-data/bin/python scripts/build_dataset.py
```

The fetch script defaults to the inferred current competition slug `march-machine-learning-mania-2026`. If Kaggle changes the slug, override it:

```bash
python3 scripts/fetch_kaggle_data.py --competition your-competition-slug
```

`scripts/sync_public_repo_data.sh` can clone a public March Madness repo and copy its public raw files into `data/raw/public-repo/` as a starting point for extending the ETL.

## Structure

- `src/app`: Next.js routes
- `src/components`: reusable presentation and bracket UI
- `src/lib`: types, data access, transforms, bracket logic
- `data/raw`: source CSVs and reference files for the ETL
- `data/processed`: generated JSON consumed by the site
- `scripts`: Python ETL and content generation
