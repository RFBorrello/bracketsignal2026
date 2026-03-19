from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

EXPECTED_FILES = [
    "MTeams.csv",
    "MNCAATourneySeeds.csv",
    "MNCAATourneyDetailedResults.csv",
    "MRegularSeasonDetailedResults.csv",
    "MMasseyOrdinals.csv",
]

OPTIONAL_FILES = [
    "MTeamConferences.csv",
    "MTeamCoaches.csv",
    "MConferenceTourneyGames.csv",
    "MSeasons.csv",
    "Cities.csv",
    "MGameCities.csv",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download March Machine Learning Mania data with kagglehub into data/raw.",
    )
    parser.add_argument(
        "--competition",
        default="march-machine-learning-mania-2026",
        help="Kaggle competition slug. Default: %(default)s",
    )
    parser.add_argument(
        "--token-file",
        default=str(Path.home() / ".kaggle" / "access_token"),
        help="Path to Kaggle access_token file. Default: %(default)s",
    )
    return parser.parse_args()


def ensure_kagglehub():
    try:
        import kagglehub  # noqa: F401
    except ModuleNotFoundError:
        print(
            "fetch_kagglehub_data.py: kagglehub is not installed.\n"
            "Install it with:\n"
            "  .venv-data/bin/python -m pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1)


def ensure_access_token(token_file: Path) -> None:
    if token_file.exists():
        return
    print(
        f"fetch_kagglehub_data.py: missing access token file at {token_file}\n"
        "Kaggle's newer API tokens should be stored as ~/.kaggle/access_token "
        "or passed via KAGGLE_API_TOKEN.",
        file=sys.stderr,
    )
    raise SystemExit(1)


def copy_files(download_dir: Path, filenames: list[str]) -> list[str]:
    copied: list[str] = []
    for filename in filenames:
        matches = list(download_dir.rglob(filename))
        if not matches:
            continue
        shutil.copy2(matches[0], RAW / filename)
        copied.append(filename)
    return copied


def main() -> None:
    args = parse_args()
    token_file = Path(args.token_file).expanduser()
    RAW.mkdir(parents=True, exist_ok=True)
    ensure_kagglehub()
    ensure_access_token(token_file)

    import kagglehub

    print(f"fetch_kagglehub_data.py: downloading competition files for {args.competition}", file=sys.stderr)
    try:
        download_dir = Path(kagglehub.competition_download(args.competition))
    except Exception as exc:
        print(f"fetch_kagglehub_data.py: Kaggle download failed: {exc}", file=sys.stderr)
        print(
            "fetch_kagglehub_data.py: if this is a 403/401, make sure you have accepted the competition rules at:\n"
            f"  https://www.kaggle.com/competitions/{args.competition}/rules",
            file=sys.stderr,
        )
        raise SystemExit(1)
    print(f"fetch_kagglehub_data.py: kagglehub cache path: {download_dir}", file=sys.stderr)

    copied = copy_files(download_dir, EXPECTED_FILES + OPTIONAL_FILES)
    missing = [filename for filename in EXPECTED_FILES if filename not in copied]
    optional = [filename for filename in OPTIONAL_FILES if filename in copied]
    print(f"fetch_kagglehub_data.py: copied files: {', '.join(copied) if copied else 'none'}", file=sys.stderr)
    if optional:
        print(f"fetch_kagglehub_data.py: optional files copied: {', '.join(optional)}", file=sys.stderr)
    if missing:
        print(f"fetch_kagglehub_data.py: still missing: {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)
    print("fetch_kagglehub_data.py: all required raw files are now in data/raw", file=sys.stderr)


if __name__ == "__main__":
    main()
