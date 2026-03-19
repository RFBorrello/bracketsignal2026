from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
BRACKET_FILE = ROOT / "src" / "lib" / "2026-bracket.ts"
OUTPUT_FILE = ROOT / "data" / "processed" / "team-stats-2026.json"
API_BASE = "https://ncaa-api.henrygd.me/stats/basketball-men/d1/current/team"

IGNORE_KEYS = {"Rank", "Team", "GM", "G", "W", "L"}
RECORD_STAT_ID = 168

METRICS = {
    "scoringOffense": 145,
    "scoringDefense": 146,
    "scoringMargin": 147,
    "threePointPct": 152,
    "threePointPctDefense": 518,
    "offensiveReboundsPerGame": 857,
    "turnoversPerGame": 217,
    "assistTurnoverRatio": 474,
    "turnoverMargin": 519,
    "turnoversForcedPerGame": 931,
}

TEAM_ALIAS_MAP = {
    "byu": "byu",
    "calbaptist": "californiabaptist",
    "hawaii": "hawaii",
    "liu": "liu",
    "miami": "miamifl",
    "miamifl": "miamifl",
    "miamiofohio": "miamioh",
    "miamioh": "miamioh",
    "michiganstate": "michiganst",
    "northdakotastate": "northdakotast",
    "northerniowa": "uni",
    "ohiostate": "ohiost",
    "prairieviewaandm": "prairieview",
    "prairieview": "prairieview",
    "queens": "queensnc",
    "queensnc": "queensnc",
    "saintlouis": "stlouis",
    "saintmarys": "stmarysca",
    "smu": "smu",
    "southflorida": "southfla",
    "stjohns": "stjohnsny",
    "stjohnsny": "stjohnsny",
    "stlouis": "stlouis",
    "stmarys": "stmarysca",
    "stmarysca": "stmarysca",
    "texasam": "txam",
    "ucf": "ucf",
    "uconn": "connecticut",
    "iowastate": "iowast",
    "umbc": "umbc",
    "vcu": "vcu",
}


def normalize_team_name(name: str) -> str:
    normalized = name.lower().replace("saint", "st").replace("state", "st").replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "", normalized)


def parse_rank(value: str) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_value(value: str) -> float | None:
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def parse_int(value: str) -> int | None:
    try:
        return int(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def bracket_teams() -> list[str]:
    text = BRACKET_FILE.read_text(encoding="utf-8")
    teams: set[str] = set()
    for match in re.finditer(r'name: "([^"]+)"', text):
        team = match.group(1)
        if "/" in team:
            teams.update(part.strip() for part in team.split("/") if part.strip())
        else:
            teams.add(team)
    return sorted(teams)


def fetch_json(url: str) -> dict:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_metric(stat_id: int) -> tuple[str, str, str, list[dict]]:
    page = 1
    all_rows: list[dict] = []
    title = ""
    updated = ""
    value_field = ""

    while True:
        query = urlencode({"page": page})
        payload = fetch_json(f"{API_BASE}/{stat_id}?{query}")
        title = payload.get("title", title)
        updated = payload.get("updated", updated)
        rows = payload.get("data", [])
        if rows and not value_field:
            metric_keys = [key for key in rows[0].keys() if key not in IGNORE_KEYS]
            value_field = metric_keys[-1]
        all_rows.extend(rows)
        if page >= int(payload.get("pages", page)):
            break
        page += 1

    return title, updated, value_field, all_rows


def resolve_team_name(team: str, available_rows: dict[str, dict]) -> tuple[str | None, str]:
    normalized = TEAM_ALIAS_MAP.get(normalize_team_name(team), normalize_team_name(team))
    row = available_rows.get(normalized)
    if row:
        return row["Team"], normalized
    return None, normalized


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    teams = bracket_teams()
    categories: dict[str, dict] = {}
    team_records: dict[str, dict] = {team: {"team": team, "sourceTeam": None, "stats": {}} for team in teams}
    missing: dict[str, list[str]] = {team: [] for team in teams}
    updated_label = ""

    record_title, record_updated, _, record_rows = fetch_metric(RECORD_STAT_ID)
    if record_updated:
        updated_label = record_updated
    indexed_record_rows = {
        TEAM_ALIAS_MAP.get(normalize_team_name(row["Team"]), normalize_team_name(row["Team"])): row for row in record_rows
    }

    for team in teams:
        source_team, normalized = resolve_team_name(team, indexed_record_rows)
        row = indexed_record_rows.get(normalized)
        if not row:
            missing[team].append("record")
            continue
        wins = parse_int(row.get("W"))
        losses = parse_int(row.get("L"))
        pct = parse_value(row.get("Pct"))
        if wins is None or losses is None:
            missing[team].append("record")
            continue
        team_records[team]["sourceTeam"] = source_team
        team_records[team]["record"] = {
            "rank": parse_rank(row.get("Rank")),
            "wins": wins,
            "losses": losses,
            "pct": pct,
            "display": f"{wins}-{losses}",
            "games": wins + losses,
        }

    for metric_name, stat_id in METRICS.items():
        title, updated, value_field, rows = fetch_metric(stat_id)
        if updated and not updated_label:
            updated_label = updated
        categories[metric_name] = {
            "statId": stat_id,
            "title": title,
            "valueField": value_field,
        }
        indexed_rows = {
            TEAM_ALIAS_MAP.get(normalize_team_name(row["Team"]), normalize_team_name(row["Team"])): row for row in rows
        }

        for team in teams:
            source_team, normalized = resolve_team_name(team, indexed_rows)
            row = indexed_rows.get(normalized)
            if not row:
                missing[team].append(metric_name)
                continue
            parsed_value = parse_value(row.get(value_field))
            if parsed_value is None:
                missing[team].append(metric_name)
                continue
            team_records[team]["sourceTeam"] = source_team
            team_records[team]["stats"][metric_name] = {
                "rank": parse_rank(row.get("Rank")),
                "value": parsed_value,
                "display": row[value_field],
                "games": int(row.get("GM", row.get("G", 0) or 0)),
            }

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "updated": updated_label,
        "source": {
            "label": "Official NCAA team statistics via ncaa-api snapshot",
            "url": "https://www.ncaa.com/stats/basketball-men/d1/current/team/145",
        },
        "recordMetric": {
            "statId": RECORD_STAT_ID,
            "title": record_title,
            "valueField": "Pct",
        },
        "metrics": categories,
        "teams": team_records,
        "missing": {team: items for team, items in missing.items() if items},
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"wrote {OUTPUT_FILE}")
    if payload["missing"]:
        print("teams with missing metric matches:")
        for team, items in payload["missing"].items():
            print(f"  {team}: {', '.join(items)}")
    else:
        print(f"matched {len(teams)} non-play-in bracket teams across all live stat categories")


if __name__ == "__main__":
    main()
