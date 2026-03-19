from __future__ import annotations

import argparse
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DOWNLOADS = RAW / "kaggle_download"

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
        description="Download March Machine Learning Mania data from Kaggle into data/raw.",
    )
    parser.add_argument(
        "--competition",
        default="march-machine-learning-mania-2026",
        help="Kaggle competition slug. Default: %(default)s",
    )
    parser.add_argument(
        "--keep-archive",
        action="store_true",
        help="Keep the downloaded zip file after extraction.",
    )
    return parser.parse_args()


def import_kaggle_api():
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except ModuleNotFoundError:
        print(
            "fetch_kaggle_data.py: Kaggle API package is not installed.\n"
            "Install it with:\n"
            "  python3 -m pip install -r scripts/requirements.txt",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return KaggleApi


def authenticate(api_cls):
    try:
        api = api_cls()
        api.authenticate()
        return api
    except Exception as exc:  # pragma: no cover - auth errors are environment-specific
        print(
            "fetch_kaggle_data.py: Kaggle authentication failed.\n"
            "Create an API token at https://www.kaggle.com/settings and place kaggle.json at ~/.kaggle/kaggle.json\n"
            "or export KAGGLE_USERNAME and KAGGLE_KEY.",
            file=sys.stderr,
        )
        print(f"fetch_kaggle_data.py: auth error: {exc}", file=sys.stderr)
        raise SystemExit(1)


def unzip_archives(download_dir: Path) -> None:
    for archive in download_dir.glob("*.zip"):
        with zipfile.ZipFile(archive) as zip_handle:
            zip_handle.extractall(download_dir)


def copy_files(download_dir: Path, filenames: list[str]) -> list[str]:
    copied: list[str] = []
    for filename in filenames:
        matches = list(download_dir.rglob(filename))
        if not matches:
            continue
        source = matches[0]
        target = RAW / filename
        shutil.copy2(source, target)
        copied.append(filename)
    return copied


def main() -> None:
    args = parse_args()
    RAW.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)

    KaggleApi = import_kaggle_api()
    api = authenticate(KaggleApi)

    print(f"fetch_kaggle_data.py: downloading competition files for {args.competition}", file=sys.stderr)
    try:
        api.competition_download_files(args.competition, path=str(DOWNLOADS), quiet=False)
    except Exception as exc:
        print(f"fetch_kaggle_data.py: Kaggle download failed: {exc}", file=sys.stderr)
        print(
            "fetch_kaggle_data.py: if this is a 403/401, make sure you have accepted the competition rules at:\n"
            f"  https://www.kaggle.com/competitions/{args.competition}/rules",
            file=sys.stderr,
        )
        raise SystemExit(1)

    unzip_archives(DOWNLOADS)
    copied = copy_files(DOWNLOADS, EXPECTED_FILES + OPTIONAL_FILES)

    missing = [filename for filename in EXPECTED_FILES if filename not in copied]
    optional = [filename for filename in OPTIONAL_FILES if filename in copied]
    print(f"fetch_kaggle_data.py: copied files: {', '.join(copied) if copied else 'none'}", file=sys.stderr)
    if optional:
        print(f"fetch_kaggle_data.py: optional files copied: {', '.join(optional)}", file=sys.stderr)
    if missing:
        print(f"fetch_kaggle_data.py: still missing: {', '.join(missing)}", file=sys.stderr)
        print(
            "fetch_kaggle_data.py: this usually means the competition slug is wrong or you have not joined/accepted the competition rules yet.",
            file=sys.stderr,
        )
    else:
        print("fetch_kaggle_data.py: all required raw files are now in data/raw", file=sys.stderr)

    if not args.keep_archive:
        for archive in DOWNLOADS.glob("*.zip"):
            archive.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
