from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"

OPTIONAL_FILES = [
    "MTeamConferences.csv",
    "MTeamCoaches.csv",
    "MConferenceTourneyGames.csv",
    "Conferences.csv",
    "MSeasons.csv",
]

ROUND_ORDER = {
    "First Four": 0,
    "Round of 64": 1,
    "Round of 32": 2,
    "Sweet 16": 3,
    "Elite Eight": 4,
    "Final Four": 5,
    "National Championship": 6,
}


@dataclass
class Signal:
    label: str
    direction: str
    value: str
    strength: float
    detail: str


def seed_number(seed: str | float | int | None) -> int | None:
    if seed is None or (isinstance(seed, float) and math.isnan(seed)):
        return None
    digits = "".join(ch for ch in str(seed) if ch.isdigit())
    if not digits:
        return None
    return int(digits[:2])


def canonical_round(day_num: int) -> str:
    mapping = {
        134: "First Four",
        135: "First Four",
        136: "Round of 64",
        137: "Round of 64",
        138: "Round of 32",
        139: "Round of 32",
        143: "Sweet 16",
        144: "Sweet 16",
        145: "Elite Eight",
        146: "Elite Eight",
        152: "Final Four",
        154: "National Championship",
    }
    return mapping.get(day_num, f"Day {day_num}")


def round_sort_key(round_name: str) -> int:
    return ROUND_ORDER.get(round_name, 99)


def load_csv(name: str) -> pd.DataFrame:
    path = RAW / name
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path)


def load_optional_csv(name: str) -> pd.DataFrame | None:
    path = RAW / name
    if not path.exists():
        return None
    return pd.read_csv(path)


def safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        if value is None:
            return fallback
        if isinstance(value, float) and math.isnan(value):
            return fallback
        return float(value)
    except (TypeError, ValueError):
        return fallback


def safe_int(value: Any, fallback: int = 0) -> int:
    try:
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return fallback
        return int(value)
    except (TypeError, ValueError):
        return fallback


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def logistic(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [json_safe(item) for item in value]
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    try:
        if value is None or value == "" or isinstance(value, (str, int, bool)):
            return value
        if getattr(value, "item", None):
            return json_safe(value.item())
    except Exception:
        pass
    return value


def inverse_loc(loc: str) -> str:
    if loc == "H":
        return "A"
    if loc == "A":
        return "H"
    return "N"


def build_team_game_logs(results: pd.DataFrame) -> pd.DataFrame:
    stat_cols = [
        "FGM",
        "FGA",
        "FGM3",
        "FGA3",
        "FTM",
        "FTA",
        "OR",
        "DR",
        "Ast",
        "TO",
        "Stl",
        "Blk",
        "PF",
    ]
    frames: list[pd.DataFrame] = []

    for side in ("W", "L"):
        opp = "L" if side == "W" else "W"
        own_cols = {f"{side}{col}": col for col in stat_cols}
        opp_cols = {f"{opp}{col}": f"Opp{col}" for col in stat_cols}
        frame = results[
            [
                "Season",
                "DayNum",
                "NumOT",
                "WLoc",
                f"{side}TeamID",
                f"{opp}TeamID",
                f"{side}Score",
                f"{opp}Score",
                *own_cols.keys(),
                *opp_cols.keys(),
            ]
        ].copy()
        frame = frame.rename(
            columns={
                f"{side}TeamID": "TeamID",
                f"{opp}TeamID": "OppTeamID",
                f"{side}Score": "Score",
                f"{opp}Score": "OppScore",
                **own_cols,
                **opp_cols,
            }
        )
        frame["Loc"] = frame["WLoc"].map(lambda loc: loc if side == "W" else inverse_loc(loc))
        frame["Win"] = 1 if side == "W" else 0
        frames.append(frame)

    base = pd.concat(frames, ignore_index=True)
    base["Possessions"] = base["FGA"] - base["OR"] + base["TO"] + 0.475 * base["FTA"]
    base["OppPossessions"] = (
        base["OppFGA"] - base["OppOR"] + base["OppTO"] + 0.475 * base["OppFTA"]
    )
    base["AdjPossessions"] = (base["Possessions"] + base["OppPossessions"]) / 2
    base["AdjPossessions"] = base["AdjPossessions"].replace(0, math.nan)

    base["OffRating"] = (base["Score"] / base["AdjPossessions"]) * 100
    base["DefRating"] = (base["OppScore"] / base["AdjPossessions"]) * 100
    base["NetRating"] = base["OffRating"] - base["DefRating"]
    base["Pace"] = base["AdjPossessions"]
    base["Margin"] = base["Score"] - base["OppScore"]
    base["CloseGame"] = (base["Margin"].abs() <= 5).astype(int)
    base["OTFlag"] = (base["NumOT"] > 0).astype(int)

    base["EFG"] = (base["FGM"] + 0.5 * base["FGM3"]) / base["FGA"].replace(0, math.nan)
    base["OppEFG"] = (base["OppFGM"] + 0.5 * base["OppFGM3"]) / base["OppFGA"].replace(0, math.nan)
    base["ThreePointRate"] = base["FGA3"] / base["FGA"].replace(0, math.nan)
    base["ThreePointPct"] = base["FGM3"] / base["FGA3"].replace(0, math.nan)
    base["FTARate"] = base["FTA"] / base["FGA"].replace(0, math.nan)
    base["FTPct"] = base["FTM"] / base["FTA"].replace(0, math.nan)
    base["TurnoverRate"] = base["TO"] / base["AdjPossessions"]
    base["OffRebRate"] = base["OR"] / (base["OR"] + base["OppDR"]).replace(0, math.nan)
    base["DefRebRate"] = base["DR"] / (base["DR"] + base["OppOR"]).replace(0, math.nan)
    base["AssistRate"] = base["Ast"] / base["FGM"].replace(0, math.nan)
    base["StealRate"] = base["Stl"] / base["OppPossessions"].replace(0, math.nan)
    base["BlockRate"] = base["Blk"] / base["OppFGA"].replace(0, math.nan)
    base["FoulRate"] = base["PF"] / base["AdjPossessions"]

    for col in [
        "OffRating",
        "DefRating",
        "NetRating",
        "Pace",
        "EFG",
        "OppEFG",
        "ThreePointRate",
        "ThreePointPct",
        "FTARate",
        "FTPct",
        "TurnoverRate",
        "OffRebRate",
        "DefRebRate",
        "AssistRate",
        "StealRate",
        "BlockRate",
        "FoulRate",
    ]:
        base[col] = pd.to_numeric(base[col], errors="coerce").fillna(0.0)

    return base


def summarize_profile(logs: pd.DataFrame, prefix: str = "") -> pd.DataFrame:
    grouped = (
        logs.groupby(["Season", "TeamID"], as_index=False)
        .agg(
            games=("Win", "count"),
            wins=("Win", "sum"),
            off_rating=("OffRating", "mean"),
            def_rating=("DefRating", "mean"),
            pace=("Pace", "mean"),
            efg_pct=("EFG", "mean"),
            opp_efg_pct=("OppEFG", "mean"),
            three_rate=("ThreePointRate", "mean"),
            three_pct=("ThreePointPct", "mean"),
            fta_rate=("FTARate", "mean"),
            ft_pct=("FTPct", "mean"),
            turnover_rate=("TurnoverRate", "mean"),
            off_reb_rate=("OffRebRate", "mean"),
            def_reb_rate=("DefRebRate", "mean"),
            assist_rate=("AssistRate", "mean"),
            steal_rate=("StealRate", "mean"),
            block_rate=("BlockRate", "mean"),
            foul_rate=("FoulRate", "mean"),
            avg_score=("Score", "mean"),
            avg_allowed=("OppScore", "mean"),
            margin=("Margin", "mean"),
            margin_std=("Margin", "std"),
            ot_rate=("OTFlag", "mean"),
        )
    )

    grouped["win_pct"] = grouped["wins"] / grouped["games"].replace(0, math.nan)
    grouped["net_rating"] = grouped["off_rating"] - grouped["def_rating"]
    grouped["margin_std"] = grouped["margin_std"].fillna(0.0)

    close_games = (
        logs[logs["CloseGame"] == 1]
        .groupby(["Season", "TeamID"], as_index=False)
        .agg(close_game_count=("Win", "count"), close_game_wins=("Win", "sum"))
    )
    close_games["close_game_win_pct"] = close_games["close_game_wins"] / close_games["close_game_count"].replace(
        0, math.nan
    )

    neutral_games = (
        logs[logs["Loc"] == "N"]
        .groupby(["Season", "TeamID"], as_index=False)
        .agg(neutral_games=("Win", "count"), neutral_wins=("Win", "sum"))
    )
    neutral_games["neutral_win_pct"] = neutral_games["neutral_wins"] / neutral_games["neutral_games"].replace(
        0, math.nan
    )

    merged = grouped.merge(
        close_games[["Season", "TeamID", "close_game_win_pct"]],
        how="left",
        on=["Season", "TeamID"],
    ).merge(
        neutral_games[["Season", "TeamID", "neutral_win_pct"]],
        how="left",
        on=["Season", "TeamID"],
    )

    merged["close_game_win_pct"] = merged["close_game_win_pct"].fillna(0.5)
    merged["neutral_win_pct"] = merged["neutral_win_pct"].fillna(merged["win_pct"].fillna(0.0))

    if prefix:
        return merged.rename(
            columns={col: f"{prefix}{col}" for col in merged.columns if col not in {"Season", "TeamID"}}
        )
    return merged


def recent_profile(logs: pd.DataFrame, window: int, prefix: str) -> pd.DataFrame:
    recent = logs.sort_values(["Season", "TeamID", "DayNum"]).groupby(["Season", "TeamID"], as_index=False).tail(
        window
    )
    summary = (
        recent.groupby(["Season", "TeamID"], as_index=False)
        .agg(
            recent_games=("Win", "count"),
            recent_wins=("Win", "sum"),
            recent_net_rating=("NetRating", "mean"),
            recent_efg_pct=("EFG", "mean"),
            recent_turnover_rate=("TurnoverRate", "mean"),
            recent_three_rate=("ThreePointRate", "mean"),
            recent_margin=("Margin", "mean"),
            recent_pace=("Pace", "mean"),
        )
    )
    summary["recent_win_pct"] = summary["recent_wins"] / summary["recent_games"].replace(0, math.nan)
    summary = summary.drop(columns=["recent_games", "recent_wins"])
    return summary.rename(columns={col: f"{prefix}{col}" for col in summary.columns if col not in {"Season", "TeamID"}})


def rating_frame(rankings: pd.DataFrame) -> pd.DataFrame:
    latest_by_system = (
        rankings.sort_values(["Season", "TeamID", "SystemName", "RankingDayNum"])
        .groupby(["Season", "TeamID", "SystemName"], as_index=False)
        .tail(1)
    )
    latest_summary = (
        latest_by_system.groupby(["Season", "TeamID"], as_index=False)
        .agg(
            rating_mean=("OrdinalRank", "mean"),
            rating_best=("OrdinalRank", "min"),
            rating_worst=("OrdinalRank", "max"),
            rating_std=("OrdinalRank", "std"),
            systems=("SystemName", "nunique"),
            latest_ranking_day=("RankingDayNum", "max"),
        )
    )
    latest_summary["rating_std"] = latest_summary["rating_std"].fillna(0.0)
    latest_summary["rating_spread"] = latest_summary["rating_worst"] - latest_summary["rating_best"]

    early = rankings[rankings["RankingDayNum"] <= 100]
    if early.empty:
        latest_summary["rating_early_mean"] = latest_summary["rating_mean"]
        latest_summary["rating_trend"] = 0.0
        return latest_summary

    early_by_system = (
        early.sort_values(["Season", "TeamID", "SystemName", "RankingDayNum"])
        .groupby(["Season", "TeamID", "SystemName"], as_index=False)
        .tail(1)
    )
    early_summary = (
        early_by_system.groupby(["Season", "TeamID"], as_index=False)
        .agg(rating_early_mean=("OrdinalRank", "mean"))
    )
    merged = latest_summary.merge(early_summary, how="left", on=["Season", "TeamID"])
    merged["rating_early_mean"] = merged["rating_early_mean"].fillna(merged["rating_mean"])
    merged["rating_trend"] = merged["rating_early_mean"] - merged["rating_mean"]
    return merged


def active_conference_map(team_conferences: pd.DataFrame | None) -> pd.DataFrame | None:
    if team_conferences is None:
        return None
    return team_conferences.rename(columns={"ConfAbbrev": "conference"})


def active_coach_map(team_coaches: pd.DataFrame | None) -> pd.DataFrame | None:
    if team_coaches is None:
        return None
    active = team_coaches[(team_coaches["FirstDayNum"] <= 133) & (team_coaches["LastDayNum"] >= 133)].copy()
    if active.empty:
        active = (
            team_coaches.sort_values(["Season", "TeamID", "LastDayNum"])
            .groupby(["Season", "TeamID"], as_index=False)
            .tail(1)
        )
    active = active.rename(columns={"CoachName": "coach"})
    active = active.sort_values(["TeamID", "Season"])
    tenures: list[int] = []
    previous_by_team: dict[int, tuple[int, str, int]] = {}
    for _, row in active.iterrows():
        team_id = safe_int(row["TeamID"])
        season = safe_int(row["Season"])
        coach = str(row["coach"])
        prev = previous_by_team.get(team_id)
        tenure = 1
        if prev and prev[0] == season - 1 and prev[1] == coach:
            tenure = prev[2] + 1
        previous_by_team[team_id] = (season, coach, tenure)
        tenures.append(tenure)
    active["coach_tenure"] = tenures
    return active[["Season", "TeamID", "coach", "coach_tenure"]]


def conference_strengths(profiles: pd.DataFrame, team_conf: pd.DataFrame | None) -> pd.DataFrame | None:
    if "conference" in profiles.columns:
        merged = profiles
    elif team_conf is not None:
        merged = profiles.merge(team_conf, how="left", on=["Season", "TeamID"])
    else:
        return None
    strengths = (
        merged.dropna(subset=["conference"])
        .groupby(["Season", "conference"], as_index=False)
        .agg(
            conference_rating_mean=("rating_mean", "mean"),
            conference_net_rating=("net_rating", "mean"),
            conference_teams=("TeamID", "count"),
        )
    )
    strengths["conference_strength"] = -strengths["conference_rating_mean"]
    strengths["conference_strength_rank"] = strengths.groupby("Season")["conference_rating_mean"].rank(
        method="dense"
    )
    return strengths


def conference_champions(conf_games: pd.DataFrame | None) -> pd.DataFrame | None:
    if conf_games is None:
        return None
    latest_games = (
        conf_games.sort_values(["Season", "ConfAbbrev", "DayNum"])
        .groupby(["Season", "ConfAbbrev"], as_index=False)
        .tail(1)
    )
    latest_games = latest_games.rename(columns={"WTeamID": "TeamID", "ConfAbbrev": "conference"})
    latest_games["conference_champion"] = True
    return latest_games[["Season", "TeamID", "conference", "conference_champion"]]


def historical_experience(
    tourney: pd.DataFrame,
    coaches: pd.DataFrame | None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    participant_games = []
    for side in ("W", "L"):
        frame = tourney[["Season", f"{side}TeamID"]].copy()
        frame = frame.rename(columns={f"{side}TeamID": "TeamID"})
        frame["games_played"] = 1
        participant_games.append(frame)
    team_games = pd.concat(participant_games, ignore_index=True)
    team_history = (
        team_games.groupby(["Season", "TeamID"], as_index=False)
        .agg(tournament_games=("games_played", "sum"))
        .sort_values(["TeamID", "Season"])
    )
    team_history["program_tournament_games_before"] = (
        team_history.groupby("TeamID")["tournament_games"].cumsum() - team_history["tournament_games"]
    )
    team_history["program_tournament_appearances_before"] = (
        team_history.groupby("TeamID").cumcount()
    )

    if coaches is None:
        empty = team_history[["Season", "TeamID"]].copy()
        empty["coach_tournament_games_before"] = 0
        empty["coach_tournament_appearances_before"] = 0
        return team_history, empty

    coach_history = team_history.merge(coaches, how="left", on=["Season", "TeamID"])
    coach_summary = (
        coach_history.dropna(subset=["coach"])
        .groupby(["Season", "coach"], as_index=False)
        .agg(coach_tournament_games=("tournament_games", "sum"))
        .sort_values(["coach", "Season"])
    )
    coach_summary["coach_tournament_games_before"] = (
        coach_summary.groupby("coach")["coach_tournament_games"].cumsum() - coach_summary["coach_tournament_games"]
    )
    coach_summary["coach_tournament_appearances_before"] = coach_summary.groupby("coach").cumcount()
    coach_summary = coach_summary[["Season", "coach", "coach_tournament_games_before", "coach_tournament_appearances_before"]]
    coach_history = coach_history.merge(coach_summary, how="left", on=["Season", "coach"])
    coach_history["coach_tournament_games_before"] = coach_history["coach_tournament_games_before"].fillna(0)
    coach_history["coach_tournament_appearances_before"] = coach_history["coach_tournament_appearances_before"].fillna(0)
    return team_history, coach_history[["Season", "TeamID", "coach_tournament_games_before", "coach_tournament_appearances_before"]]


def weighted_preference(profile: pd.Series) -> float:
    def lookup(name: str, fallback: float = 0.0) -> float:
        for candidate in (name, f"winner_{name}", f"loser_{name}"):
            if candidate in profile.index:
                return safe_float(profile[candidate], fallback)
        return fallback

    return (
        lookup("net_rating") * 0.55
        + lookup("recent10_recent_net_rating") * 0.35
        + (200 - lookup("rating_mean", 175.0)) * 0.10
    )


def build_postgame_swings(row: pd.Series, winner_name: str, loser_name: str) -> list[str]:
    def team_metrics(prefix: str) -> dict[str, float]:
        fga = safe_float(row[f"{prefix}FGA"], 1.0)
        fta = safe_float(row[f"{prefix}FTA"], 0.0)
        possessions = safe_float(row[f"{prefix}FGA"]) - safe_float(row[f"{prefix}OR"]) + safe_float(row[f"{prefix}TO"]) + 0.475 * fta
        possessions = possessions if possessions > 0 else 1.0
        return {
            "efg": (safe_float(row[f"{prefix}FGM"]) + 0.5 * safe_float(row[f"{prefix}FGM3"])) / fga,
            "turnover_rate": safe_float(row[f"{prefix}TO"]) / possessions,
            "off_reb_rate": safe_float(row[f"{prefix}OR"]) / max(1.0, safe_float(row[f"{prefix}OR"]) + safe_float(row[f"{'L' if prefix == 'W' else 'W'}DR"])),
            "fta_rate": fta / fga,
            "three_rate": safe_float(row[f"{prefix}FGA3"]) / fga,
        }

    winner = team_metrics("W")
    loser = team_metrics("L")
    swings = [
        (
            abs(winner["efg"] - loser["efg"]),
            f"{winner_name} won the shotmaking battle by {abs(winner['efg'] - loser['efg']) * 100:.1f} eFG points.",
        ),
        (
            abs(winner["turnover_rate"] - loser["turnover_rate"]),
            f"{winner_name} protected possessions better, creating a turnover-rate edge of {abs(winner['turnover_rate'] - loser['turnover_rate']) * 100:.1f} points.",
        ),
        (
            abs(winner["off_reb_rate"] - loser["off_reb_rate"]),
            f"{winner_name} tilted the offensive glass by {abs(winner['off_reb_rate'] - loser['off_reb_rate']) * 100:.1f} points.",
        ),
        (
            abs(winner["fta_rate"] - loser["fta_rate"]),
            f"{winner_name} generated more foul pressure with a free-throw rate edge of {abs(winner['fta_rate'] - loser['fta_rate']) * 100:.1f} points.",
        ),
    ]
    swings.sort(key=lambda item: item[0], reverse=True)
    return [text for _, text in swings[:2]]


def build_matchup_vectors(matchups: list[dict[str, Any]]) -> tuple[list[str], list[list[float]], list[int], list[int]]:
    feature_names = [
        "seed_gap",
        "net_rating_gap",
        "rating_gap",
        "recent_net_gap",
        "recent_form_gap",
        "efg_gap",
        "three_pct_gap",
        "three_rate_gap",
        "turnover_gap",
        "rebound_gap",
        "ft_rate_gap",
        "pace_gap",
        "conference_strength_gap",
        "coach_experience_gap",
        "program_experience_gap",
        "rating_stability_gap",
        "favorite_stability",
        "underdog_volatility",
    ]
    vectors: list[list[float]] = []
    outcomes: list[int] = []
    seasons: list[int] = []
    for matchup in matchups:
        snapshot = matchup["featureSnapshot"]["matchup"]
        vector = [safe_float(snapshot.get(name)) for name in feature_names]
        vectors.append(vector)
        outcomes.append(1 if matchup["favoriteWon"] else 0)
        seasons.append(matchup["season"])
    return feature_names, vectors, outcomes, seasons


def fit_logistic_model(train_vectors: list[list[float]], train_y: list[int]) -> tuple[list[float], list[float], list[float]]:
    import numpy as np

    x = np.asarray(train_vectors, dtype=float)
    y = np.asarray(train_y, dtype=float)
    means = x.mean(axis=0)
    stds = x.std(axis=0)
    stds[stds == 0] = 1.0
    x_norm = (x - means) / stds
    x_design = np.concatenate([np.ones((x_norm.shape[0], 1)), x_norm], axis=1)
    weights = np.zeros(x_design.shape[1], dtype=float)
    lr = 0.08
    l2 = 0.01
    for _ in range(900):
        scores = x_design @ weights
        probs = 1.0 / (1.0 + np.exp(-scores))
        grad = (x_design.T @ (probs - y)) / len(y)
        grad[1:] += l2 * weights[1:] / len(y)
        weights -= lr * grad
    return means.tolist(), stds.tolist(), weights.tolist()


def predict_logistic(vector: list[float], model: tuple[list[float], list[float], list[float]]) -> float:
    import numpy as np

    means, stds, weights = model
    x = np.asarray(vector, dtype=float)
    x = (x - np.asarray(means)) / np.asarray(stds)
    x = np.concatenate([[1.0], x])
    return float(1.0 / (1.0 + np.exp(-(x @ np.asarray(weights)))))


def baseline_probability(snapshot: dict[str, float]) -> float:
    score = (
        0.28 * safe_float(snapshot["seed_gap"])
        + 0.07 * safe_float(snapshot["net_rating_gap"])
        + 0.03 * safe_float(snapshot["recent_net_gap"])
        + 0.012 * safe_float(snapshot["rating_gap"])
        + 0.75 * safe_float(snapshot["rebound_gap"])
        + 0.75 * safe_float(snapshot["turnover_gap"])
        + 0.6 * safe_float(snapshot["conference_strength_gap"])
        + 0.05 * safe_float(snapshot["coach_experience_gap"])
    )
    return logistic(score / 4.0)


def assign_model_probabilities(matchups: list[dict[str, Any]]) -> None:
    feature_names, vectors, outcomes, seasons = build_matchup_vectors(matchups)
    del feature_names  # the order matters but does not need to be stored separately here
    unique_seasons = sorted(set(seasons))
    predictions: list[float] = [0.5] * len(matchups)
    for season in unique_seasons:
        current_idx = [idx for idx, value in enumerate(seasons) if value == season]
        train_idx = [idx for idx, value in enumerate(seasons) if value < season]
        if len(train_idx) < 200:
            for idx in current_idx:
                predictions[idx] = baseline_probability(matchups[idx]["featureSnapshot"]["matchup"])
            continue
        model = fit_logistic_model([vectors[idx] for idx in train_idx], [outcomes[idx] for idx in train_idx])
        for idx in current_idx:
            predictions[idx] = predict_logistic(vectors[idx], model)
    for idx, matchup in enumerate(matchups):
        favorite_win_prob = clamp(predictions[idx], 0.03, 0.97)
        data_completeness = matchup["featureSnapshot"]["matchup"]["data_completeness"]
        confidence = clamp(0.38 + abs(favorite_win_prob - 0.5) * 0.95 + data_completeness * 0.15, 0.35, 0.96)
        matchup["favoriteWinProbability"] = round(favorite_win_prob, 3)
        matchup["upsetLikelihood"] = round(1.0 - favorite_win_prob, 3)
        matchup["modelUpset"] = favorite_win_prob < 0.5 if matchup["favoriteWon"] else favorite_win_prob >= 0.5
        matchup["confidence"] = round(confidence, 3)


def build_signals(matchup: dict[str, Any]) -> tuple[list[Signal], list[Signal]]:
    favorite = matchup["featureSnapshot"]["favorite"]
    underdog = matchup["featureSnapshot"]["underdog"]
    m = matchup["featureSnapshot"]["matchup"]

    favorite_signals: list[Signal] = []
    underdog_signals: list[Signal] = []

    def add_signal(
        bucket: list[Signal],
        *,
        label: str,
        direction: str,
        raw_strength: float,
        value: str,
        detail: str,
    ) -> None:
        bucket.append(
            Signal(
                label=label,
                direction=direction,
                value=value,
                strength=round(clamp(raw_strength, 0.1, 0.98), 3),
                detail=detail,
            )
        )

    if m["net_rating_gap"] > 0:
        add_signal(
            favorite_signals,
            label="Season-long efficiency edge",
            direction="favorite",
            raw_strength=m["net_rating_gap"] / 18,
            value=f"{m['net_rating_gap']:.1f}",
            detail=f"{matchup['favorite']} entered with the stronger net rating profile.",
        )
    if m["recent_net_gap"] > 0:
        add_signal(
            favorite_signals,
            label="Recent-form edge",
            direction="favorite",
            raw_strength=m["recent_net_gap"] / 14,
            value=f"{m['recent_net_gap']:.1f}",
            detail=f"{matchup['favorite']} closed the regular season better over the recent window.",
        )
    if m["turnover_gap"] > 0:
        add_signal(
            favorite_signals,
            label="Ball security advantage",
            direction="favorite",
            raw_strength=m["turnover_gap"] * 14,
            value=f"{m['turnover_gap'] * 100:.1f} pts",
            detail=f"{matchup['favorite']} was less likely to hand away possessions.",
        )
    if m["rebound_gap"] > 0:
        add_signal(
            favorite_signals,
            label="Rebounding edge",
            direction="favorite",
            raw_strength=m["rebound_gap"] * 5,
            value=f"{m['rebound_gap'] * 100:.1f} pts",
            detail=f"{matchup['favorite']} owned the stronger combined rebound profile.",
        )
    if m["conference_strength_gap"] > 0.5:
        add_signal(
            favorite_signals,
            label="Conference strength",
            direction="favorite",
            raw_strength=m["conference_strength_gap"] / 25,
            value=f"{m['conference_strength_gap']:.1f}",
            detail=f"{matchup['favorite']} came from the deeper league environment.",
        )
    if m["coach_experience_gap"] > 0:
        add_signal(
            favorite_signals,
            label="Coaching tournament reps",
            direction="favorite",
            raw_strength=m["coach_experience_gap"] / 12,
            value=str(int(m["coach_experience_gap"])),
            detail=f"{matchup['favorite']} brought more prior tournament sideline experience.",
        )

    if m["recent_net_gap"] < 0:
        add_signal(
            underdog_signals,
            label="Recent form tilt",
            direction="underdog",
            raw_strength=abs(m["recent_net_gap"]) / 14,
            value=f"{abs(m['recent_net_gap']):.1f}",
            detail=f"{matchup['underdog']} entered hotter than the seed line implied.",
        )
    if m["three_rate_gap"] < 0:
        add_signal(
            underdog_signals,
            label="Three-point volatility",
            direction="underdog",
            raw_strength=abs(m["three_rate_gap"]) * 6,
            value=f"{abs(m['three_rate_gap']) * 100:.1f} pts",
            detail=f"{matchup['underdog']} leaned more heavily on threes, which raises upset variance.",
        )
    if m["three_pct_gap"] < 0:
        add_signal(
            underdog_signals,
            label="Perimeter shotmaking",
            direction="underdog",
            raw_strength=abs(m["three_pct_gap"]) * 8,
            value=f"{abs(m['three_pct_gap']) * 100:.1f} pts",
            detail=f"{matchup['underdog']} shot it better from deep over the full season.",
        )
    if m["turnover_gap"] < 0:
        add_signal(
            underdog_signals,
            label="Underdog ball security",
            direction="underdog",
            raw_strength=abs(m["turnover_gap"]) * 14,
            value=f"{abs(m['turnover_gap']) * 100:.1f} pts",
            detail=f"{matchup['underdog']} protected possessions better than the nominal favorite.",
        )
    if underdog.get("conference_champion"):
        add_signal(
            underdog_signals,
            label="Conference champion form",
            direction="underdog",
            raw_strength=0.54,
            value=underdog.get("conference") or "conference champ",
            detail=f"{matchup['underdog']} arrived off a league tournament title run.",
        )
    if matchup["seedGap"] >= 6 and matchup["round"] == "Round of 64":
        add_signal(
            underdog_signals,
            label="Classic upset lane",
            direction="underdog",
            raw_strength=0.56,
            value=f"{matchup['favoriteSeed']} vs {matchup['underdogSeed']}",
            detail="This seed profile historically produces live underdogs in the first round.",
        )
    if favorite.get("rating_spread", 0.0) > 20:
        add_signal(
            underdog_signals,
            label="Ranking uncertainty",
            direction="underdog",
            raw_strength=min(0.75, favorite["rating_spread"] / 45),
            value=f"{favorite['rating_spread']:.1f}",
            detail=f"{matchup['favorite']} drew unusually wide disagreement across ranking systems.",
        )

    favorite_signals.sort(key=lambda signal: signal.strength, reverse=True)
    underdog_signals.sort(key=lambda signal: signal.strength, reverse=True)
    if not favorite_signals:
        add_signal(
            favorite_signals,
            label="Seed-line edge",
            direction="favorite",
            raw_strength=0.35,
            value=f"{matchup['favoriteSeed']} seed",
            detail=f"{matchup['favorite']} still owned the simpler bracket case entering the game.",
        )
    if not underdog_signals:
        add_signal(
            underdog_signals,
            label="Variance path",
            direction="underdog",
            raw_strength=clamp(matchup["volatility"], 0.2, 0.6),
            value=f"{matchup['volatility'] * 100:.0f}%",
            detail=f"{matchup['underdog']} needed game-shape volatility more than structural pregame edges.",
        )
    return favorite_signals[:4], underdog_signals[:4]


def build_outcome_text(matchup: dict[str, Any], favorite_signals: list[Signal], underdog_signals: list[Signal]) -> None:
    favorite_lead = favorite_signals[0]
    underdog_lead = underdog_signals[0]
    upset_happened = matchup["seedUpset"]
    favorite_won = matchup["favoriteWon"]
    model_prob = matchup["favoriteWinProbability"]
    postgame_swings = matchup["postgameSwingFactors"]

    matchup["favoriteCaseSummary"] = (
        f"{matchup['favorite']} looked safer pregame because of {favorite_lead.label.lower()} and "
        f"{favorite_signals[1].label.lower() if len(favorite_signals) > 1 else 'seed-line control'}."
    )
    matchup["underdogCaseSummary"] = (
        f"{matchup['underdog']} had a live path through {underdog_lead.label.lower()}"
        f"{' and ' + underdog_signals[1].label.lower() if len(underdog_signals) > 1 else ''}."
    )

    if favorite_won:
        matchup["outcomeTier"] = "favorite-held"
        matchup["templateExplanation"] = (
            f"{matchup['favorite']} held serve by converting the stronger pregame profile into a win."
        )
        matchup["outcomeNarrative"] = (
            f"The favorite won as expected, and the pregame case held up more than the upset path. "
            f"The clearest favorite pillars were {favorite_lead.label.lower()} and "
            f"{favorite_signals[1].label.lower() if len(favorite_signals) > 1 else 'overall stability'}."
        )
        matchup["modelBlindSpot"] = (
            f"{matchup['underdog']} still carried a credible upset route through {underdog_lead.label.lower()}, "
            "but the favorite's stronger baseline was enough."
            if matchup["upsetLikelihood"] >= 0.35
            else None
        )
    else:
        matchup["outcomeTier"] = "seed-upset" if upset_happened else "model-upset"
        matchup["templateExplanation"] = (
            f"{matchup['favorite']} profiled as the steadier side, but {matchup['underdog']} had enough real pregame "
            "warning signs to crack the matchup."
        )
        matchup["outcomeNarrative"] = (
            f"The upset landed after the underdog path proved more important than the seed line. "
            f"Pregame, the clearest underdog indicators were {underdog_lead.label.lower()}"
            f"{' and ' + underdog_signals[1].label.lower() if len(underdog_signals) > 1 else ''}."
        )
        if model_prob >= 0.7:
            matchup["modelBlindSpot"] = (
                f"The model leaned heavily toward {matchup['favorite']}, but it likely understated "
                f"{underdog_lead.label.lower()} and the matchup volatility that kept {matchup['underdog']} live."
            )
        else:
            matchup["modelBlindSpot"] = (
                f"This was closer to a live upset than a pure shock; the underdog indicators were visible before tip."
            )

    if postgame_swings:
        matchup["outcomeNarrative"] += f" The game itself turned on {postgame_swings[0].lower()}"
        if len(postgame_swings) > 1:
            matchup["outcomeNarrative"] += f" {postgame_swings[1]}"


def build_editorial_notes(matchup: dict[str, Any]) -> list[dict[str, Any]]:
    favorite = matchup["featureSnapshot"]["favorite"]
    underdog = matchup["featureSnapshot"]["underdog"]
    m = matchup["featureSnapshot"]["matchup"]
    notes: list[dict[str, Any]] = []

    def add(tag: str, summary: str, confidence: float) -> None:
        notes.append(
            {
                "tag": tag,
                "summary": summary,
                "confidence": round(clamp(confidence, 0.35, 0.92), 2),
                "sources": [
                    {
                        "label": "Kaggle March Machine Learning Mania data",
                        "url": "https://www.kaggle.com/competitions/march-machine-learning-mania-2026/data",
                    }
                ],
            }
        )

    if abs(m["recent_net_gap"]) >= 4:
        side = matchup["favorite"] if m["recent_net_gap"] > 0 else matchup["underdog"]
        add(
            "recent-form",
            f"{side} brought the stronger late-season efficiency trend, which mattered more than raw seeding alone.",
            0.66,
        )
    if abs(m["conference_strength_gap"]) >= 6:
        side = matchup["favorite"] if m["conference_strength_gap"] > 0 else matchup["underdog"]
        add(
            "conference-context",
            f"{side} played in the tougher conference environment, giving its profile more tested context than the seed line alone showed.",
            0.61,
        )
    if underdog.get("coach_tournament_games_before", 0) > favorite.get("coach_tournament_games_before", 0):
        add(
            "coaching",
            f"{matchup['underdog']} actually entered with more prior tournament bench experience than the favorite.",
            0.58,
        )
    if favorite.get("conference_champion"):
        add(
            "favorite-stability",
            f"{matchup['favorite']} came in as a conference tournament champion, which reinforced the favorite case with fresh proof of form.",
            0.57,
        )
    if underdog.get("conference_champion"):
        add(
            "underdog-momentum",
            f"{matchup['underdog']} arrived off a conference tournament title, giving the underdog case real momentum instead of a purely theoretical upset path.",
            0.61,
        )
    if matchup["seedUpset"] and matchup["favoriteWinProbability"] >= 0.75:
        add(
            "model-miss",
            f"The upset outran a strong favorite probability, which suggests the bracket case missed how much volatility and recent form narrowed the practical gap.",
            0.72,
        )
    if not notes:
        add(
            "matchup-shape",
            f"The most useful read on this game was the style clash rather than a single overwhelming indicator.",
            0.45,
        )
    return notes[:4]


def choose_analogs(records: list[dict[str, Any]]) -> None:
    for idx, record in enumerate(records):
        current = record["featureSnapshot"]["matchup"]
        candidates: list[tuple[float, str]] = []
        for other in records[:idx]:
            if other["seedUpset"] != record["seedUpset"]:
                continue
            other_snapshot = other["featureSnapshot"]["matchup"]
            distance = 0.0
            distance += abs(other["favoriteWinProbability"] - record["favoriteWinProbability"]) * 4.0
            distance += abs(other["volatility"] - record["volatility"]) * 2.4
            distance += abs(other["seedGap"] - record["seedGap"]) * 0.22
            distance += abs(other_snapshot["recent_net_gap"] - current["recent_net_gap"]) / 10
            distance += abs(other_snapshot["turnover_gap"] - current["turnover_gap"]) * 10
            distance += abs(other_snapshot["rebound_gap"] - current["rebound_gap"]) * 8
            distance += abs(other_snapshot["conference_strength_gap"] - current["conference_strength_gap"]) / 12
            if other["round"] != record["round"]:
                distance += 0.7
            candidates.append((distance, other["gameId"]))
        candidates.sort(key=lambda item: item[0])
        record["historicalAnalogs"] = [game_id for _, game_id in candidates[:3]]


def build_dataset() -> dict[str, Any]:
    import pandas as pd

    teams = load_csv("MTeams.csv")
    seeds = load_csv("MNCAATourneySeeds.csv")
    tourney = load_csv("MNCAATourneyDetailedResults.csv")
    regular = load_csv("MRegularSeasonDetailedResults.csv")
    rankings = load_csv("MMasseyOrdinals.csv")
    team_conferences = load_optional_csv("MTeamConferences.csv")
    team_coaches = load_optional_csv("MTeamCoaches.csv")
    conf_games = load_optional_csv("MConferenceTourneyGames.csv")

    team_names = teams.set_index("TeamID")["TeamName"].to_dict()
    logs = build_team_game_logs(regular)
    full_profiles = summarize_profile(logs)
    recent10 = recent_profile(logs, 10, "recent10_")
    recent5 = recent_profile(logs, 5, "recent5_")
    ratings = rating_frame(rankings)

    profiles = (
        full_profiles.merge(ratings, how="left", on=["Season", "TeamID"])
        .merge(recent10, how="left", on=["Season", "TeamID"])
        .merge(recent5, how="left", on=["Season", "TeamID"])
    )

    for col, fallback in {
        "rating_mean": 175.0,
        "rating_best": 175.0,
        "rating_worst": 175.0,
        "rating_std": 0.0,
        "rating_spread": 0.0,
        "rating_trend": 0.0,
        "systems": 0.0,
    }.items():
        profiles[col] = profiles[col].fillna(fallback)
    for col in [
        "recent10_recent_net_rating",
        "recent10_recent_win_pct",
        "recent10_recent_efg_pct",
        "recent10_recent_turnover_rate",
        "recent10_recent_three_rate",
        "recent10_recent_margin",
        "recent10_recent_pace",
        "recent5_recent_net_rating",
        "recent5_recent_win_pct",
        "recent5_recent_margin",
    ]:
        if col in profiles.columns:
            profiles[col] = profiles[col].fillna(0.0)

    conference_map = active_conference_map(team_conferences)
    if conference_map is not None:
        profiles = profiles.merge(conference_map, how="left", on=["Season", "TeamID"])

    coach_map = active_coach_map(team_coaches)
    if coach_map is not None:
        profiles = profiles.merge(coach_map, how="left", on=["Season", "TeamID"])

    conf_strengths = conference_strengths(profiles, conference_map)
    if conf_strengths is not None:
        profiles = profiles.merge(conf_strengths, how="left", on=["Season", "conference"])

    champions = conference_champions(conf_games)
    if champions is not None:
        profiles = profiles.merge(champions[["Season", "TeamID", "conference_champion"]], how="left", on=["Season", "TeamID"])
        profiles["conference_champion"] = profiles["conference_champion"].fillna(False)
    else:
        profiles["conference_champion"] = False

    team_history, coach_history = historical_experience(tourney, coach_map)
    profiles = profiles.merge(
        team_history[["Season", "TeamID", "program_tournament_games_before", "program_tournament_appearances_before"]],
        how="left",
        on=["Season", "TeamID"],
    )
    profiles = profiles.merge(
        coach_history,
        how="left",
        on=["Season", "TeamID"],
    )
    for col in [
        "program_tournament_games_before",
        "program_tournament_appearances_before",
        "coach_tournament_games_before",
        "coach_tournament_appearances_before",
        "conference_strength",
        "conference_strength_rank",
    ]:
        if col in profiles.columns:
            profiles[col] = profiles[col].fillna(0.0)

    profiles["stability_score"] = (
        profiles["win_pct"].fillna(0) * 0.45
        + (1 - profiles["margin_std"].fillna(0) / 25).clip(lower=0) * 0.35
        + (1 - profiles["rating_spread"].fillna(0) / 60).clip(lower=0) * 0.2
    )
    profiles["upset_style_score"] = (
        profiles["three_rate"].fillna(0) * 0.45
        + (1 - profiles["turnover_rate"].fillna(0)).clip(lower=0) * 0.35
        + profiles["recent10_recent_win_pct"].fillna(0) * 0.2
    )

    seeds["seed_number"] = seeds["Seed"].map(seed_number)

    win_frame = tourney.rename(
        columns={
            "WTeamID": "WinnerID",
            "LTeamID": "LoserID",
            "WScore": "WinnerScore",
            "LScore": "LoserScore",
        }
    )
    win_frame = win_frame.merge(
        seeds[["Season", "TeamID", "Seed", "seed_number"]].rename(
            columns={"TeamID": "WinnerID", "Seed": "WinnerSeed", "seed_number": "WinnerSeedNumber"}
        ),
        how="left",
        on=["Season", "WinnerID"],
    ).merge(
        seeds[["Season", "TeamID", "Seed", "seed_number"]].rename(
            columns={"TeamID": "LoserID", "Seed": "LoserSeed", "seed_number": "LoserSeedNumber"}
        ),
        how="left",
        on=["Season", "LoserID"],
    )
    win_frame = win_frame.merge(
        profiles.add_prefix("winner_").rename(columns={"winner_Season": "Season", "winner_TeamID": "WinnerID"}),
        how="left",
        on=["Season", "WinnerID"],
    ).merge(
        profiles.add_prefix("loser_").rename(columns={"loser_Season": "Season", "loser_TeamID": "LoserID"}),
        how="left",
        on=["Season", "LoserID"],
    )

    matchups: list[dict[str, Any]] = []
    for idx, row in win_frame.iterrows():
        winner_seed = row["WinnerSeedNumber"]
        loser_seed = row["LoserSeedNumber"]
        if pd.isna(winner_seed) or pd.isna(loser_seed):
            continue

        winner_profile = row.filter(like="winner_")
        loser_profile = row.filter(like="loser_")
        same_seed = int(winner_seed) == int(loser_seed)
        if same_seed:
            favorite_is_winner = weighted_preference(winner_profile) >= weighted_preference(loser_profile)
        else:
            favorite_is_winner = int(winner_seed) < int(loser_seed)

        favorite_id = safe_int(row["WinnerID"] if favorite_is_winner else row["LoserID"])
        underdog_id = safe_int(row["LoserID"] if favorite_is_winner else row["WinnerID"])
        favorite_seed = safe_int(winner_seed if favorite_is_winner else loser_seed)
        underdog_seed = safe_int(loser_seed if favorite_is_winner else winner_seed)
        favorite_profile_prefix = "winner_" if favorite_is_winner else "loser_"
        underdog_profile_prefix = "loser_" if favorite_is_winner else "winner_"
        favorite_name = team_names.get(favorite_id, str(favorite_id))
        underdog_name = team_names.get(underdog_id, str(underdog_id))
        favorite_won = favorite_is_winner

        favorite_snapshot = {
            "teamId": favorite_id,
            "team": favorite_name,
            "seed": favorite_seed,
            "winPct": round(safe_float(row[f"{favorite_profile_prefix}win_pct"]), 3),
            "offRating": round(safe_float(row[f"{favorite_profile_prefix}off_rating"]), 2),
            "defRating": round(safe_float(row[f"{favorite_profile_prefix}def_rating"]), 2),
            "netRating": round(safe_float(row[f"{favorite_profile_prefix}net_rating"]), 2),
            "pace": round(safe_float(row[f"{favorite_profile_prefix}pace"]), 2),
            "efgPct": round(safe_float(row[f"{favorite_profile_prefix}efg_pct"]), 3),
            "threeRate": round(safe_float(row[f"{favorite_profile_prefix}three_rate"]), 3),
            "threePct": round(safe_float(row[f"{favorite_profile_prefix}three_pct"]), 3),
            "ftRate": round(safe_float(row[f"{favorite_profile_prefix}fta_rate"]), 3),
            "turnoverRate": round(safe_float(row[f"{favorite_profile_prefix}turnover_rate"]), 3),
            "offensiveReboundRate": round(safe_float(row[f"{favorite_profile_prefix}off_reb_rate"]), 3),
            "defensiveReboundRate": round(safe_float(row[f"{favorite_profile_prefix}def_reb_rate"]), 3),
            "recentNetRating": round(safe_float(row[f"{favorite_profile_prefix}recent10_recent_net_rating"]), 2),
            "recentWinPct": round(safe_float(row[f"{favorite_profile_prefix}recent10_recent_win_pct"]), 3),
            "ratingMean": round(safe_float(row[f"{favorite_profile_prefix}rating_mean"], 175.0), 2),
            "ratingBest": round(safe_float(row[f"{favorite_profile_prefix}rating_best"], 175.0), 2),
            "ratingWorst": round(safe_float(row[f"{favorite_profile_prefix}rating_worst"], 175.0), 2),
            "ratingSpread": round(safe_float(row[f"{favorite_profile_prefix}rating_spread"]), 2),
            "ratingTrend": round(safe_float(row[f"{favorite_profile_prefix}rating_trend"]), 2),
            "systems": safe_int(row[f"{favorite_profile_prefix}systems"]),
            "conference": row.get(f"{favorite_profile_prefix}conference") or None,
            "conferenceStrength": round(safe_float(row.get(f"{favorite_profile_prefix}conference_strength")), 2),
            "coach": row.get(f"{favorite_profile_prefix}coach") or None,
            "coachTenure": safe_int(row.get(f"{favorite_profile_prefix}coach_tenure")),
            "coachTournamentGamesBefore": safe_int(row.get(f"{favorite_profile_prefix}coach_tournament_games_before")),
            "programTournamentGamesBefore": safe_int(row.get(f"{favorite_profile_prefix}program_tournament_games_before")),
            "conferenceChampion": bool(row.get(f"{favorite_profile_prefix}conference_champion", False)),
            "stabilityScore": round(safe_float(row.get(f"{favorite_profile_prefix}stability_score")), 3),
            "upsetStyleScore": round(safe_float(row.get(f"{favorite_profile_prefix}upset_style_score")), 3),
        }
        underdog_snapshot = {
            "teamId": underdog_id,
            "team": underdog_name,
            "seed": underdog_seed,
            "winPct": round(safe_float(row[f"{underdog_profile_prefix}win_pct"]), 3),
            "offRating": round(safe_float(row[f"{underdog_profile_prefix}off_rating"]), 2),
            "defRating": round(safe_float(row[f"{underdog_profile_prefix}def_rating"]), 2),
            "netRating": round(safe_float(row[f"{underdog_profile_prefix}net_rating"]), 2),
            "pace": round(safe_float(row[f"{underdog_profile_prefix}pace"]), 2),
            "efgPct": round(safe_float(row[f"{underdog_profile_prefix}efg_pct"]), 3),
            "threeRate": round(safe_float(row[f"{underdog_profile_prefix}three_rate"]), 3),
            "threePct": round(safe_float(row[f"{underdog_profile_prefix}three_pct"]), 3),
            "ftRate": round(safe_float(row[f"{underdog_profile_prefix}fta_rate"]), 3),
            "turnoverRate": round(safe_float(row[f"{underdog_profile_prefix}turnover_rate"]), 3),
            "offensiveReboundRate": round(safe_float(row[f"{underdog_profile_prefix}off_reb_rate"]), 3),
            "defensiveReboundRate": round(safe_float(row[f"{underdog_profile_prefix}def_reb_rate"]), 3),
            "recentNetRating": round(safe_float(row[f"{underdog_profile_prefix}recent10_recent_net_rating"]), 2),
            "recentWinPct": round(safe_float(row[f"{underdog_profile_prefix}recent10_recent_win_pct"]), 3),
            "ratingMean": round(safe_float(row[f"{underdog_profile_prefix}rating_mean"], 175.0), 2),
            "ratingBest": round(safe_float(row[f"{underdog_profile_prefix}rating_best"], 175.0), 2),
            "ratingWorst": round(safe_float(row[f"{underdog_profile_prefix}rating_worst"], 175.0), 2),
            "ratingSpread": round(safe_float(row[f"{underdog_profile_prefix}rating_spread"]), 2),
            "ratingTrend": round(safe_float(row[f"{underdog_profile_prefix}rating_trend"]), 2),
            "systems": safe_int(row[f"{underdog_profile_prefix}systems"]),
            "conference": row.get(f"{underdog_profile_prefix}conference") or None,
            "conferenceStrength": round(safe_float(row.get(f"{underdog_profile_prefix}conference_strength")), 2),
            "coach": row.get(f"{underdog_profile_prefix}coach") or None,
            "coachTenure": safe_int(row.get(f"{underdog_profile_prefix}coach_tenure")),
            "coachTournamentGamesBefore": safe_int(row.get(f"{underdog_profile_prefix}coach_tournament_games_before")),
            "programTournamentGamesBefore": safe_int(row.get(f"{underdog_profile_prefix}program_tournament_games_before")),
            "conferenceChampion": bool(row.get(f"{underdog_profile_prefix}conference_champion", False)),
            "stabilityScore": round(safe_float(row.get(f"{underdog_profile_prefix}stability_score")), 3),
            "upsetStyleScore": round(safe_float(row.get(f"{underdog_profile_prefix}upset_style_score")), 3),
        }

        rating_gap = underdog_snapshot["ratingMean"] - favorite_snapshot["ratingMean"]
        recent_net_gap = favorite_snapshot["recentNetRating"] - underdog_snapshot["recentNetRating"]
        matchup_snapshot = {
            "seed_gap": underdog_seed - favorite_seed,
            "net_rating_gap": round(favorite_snapshot["netRating"] - underdog_snapshot["netRating"], 3),
            "rating_gap": round(rating_gap, 3),
            "recent_net_gap": round(recent_net_gap, 3),
            "recent_form_gap": round(favorite_snapshot["recentWinPct"] - underdog_snapshot["recentWinPct"], 3),
            "efg_gap": round(favorite_snapshot["efgPct"] - underdog_snapshot["efgPct"], 3),
            "three_pct_gap": round(favorite_snapshot["threePct"] - underdog_snapshot["threePct"], 3),
            "three_rate_gap": round(favorite_snapshot["threeRate"] - underdog_snapshot["threeRate"], 3),
            "turnover_gap": round(underdog_snapshot["turnoverRate"] - favorite_snapshot["turnoverRate"], 3),
            "rebound_gap": round(
                (favorite_snapshot["offensiveReboundRate"] + favorite_snapshot["defensiveReboundRate"])
                - (underdog_snapshot["offensiveReboundRate"] + underdog_snapshot["defensiveReboundRate"]),
                3,
            ),
            "ft_rate_gap": round(favorite_snapshot["ftRate"] - underdog_snapshot["ftRate"], 3),
            "pace_gap": round(favorite_snapshot["pace"] - underdog_snapshot["pace"], 3),
            "conference_strength_gap": round(
                favorite_snapshot["conferenceStrength"] - underdog_snapshot["conferenceStrength"],
                3,
            ),
            "coach_experience_gap": round(
                favorite_snapshot["coachTournamentGamesBefore"] - underdog_snapshot["coachTournamentGamesBefore"],
                3,
            ),
            "program_experience_gap": round(
                favorite_snapshot["programTournamentGamesBefore"] - underdog_snapshot["programTournamentGamesBefore"],
                3,
            ),
            "rating_stability_gap": round(
                underdog_snapshot["ratingSpread"] - favorite_snapshot["ratingSpread"],
                3,
            ),
            "favorite_stability": round(favorite_snapshot["stabilityScore"], 3),
            "underdog_volatility": round(underdog_snapshot["upsetStyleScore"], 3),
        }
        data_completeness = 0.55
        data_completeness += 0.15 if favorite_snapshot["systems"] > 0 and underdog_snapshot["systems"] > 0 else 0.0
        data_completeness += 0.15 if favorite_snapshot["conference"] and underdog_snapshot["conference"] else 0.0
        data_completeness += 0.15 if favorite_snapshot["coach"] and underdog_snapshot["coach"] else 0.0
        matchup_snapshot["data_completeness"] = round(clamp(data_completeness, 0.45, 1.0), 3)

        volatility = clamp(
            0.18
            + abs(matchup_snapshot["three_rate_gap"]) * 1.7
            + abs(matchup_snapshot["turnover_gap"]) * 2.0
            + abs(matchup_snapshot["pace_gap"]) / 55
            + abs(favorite_snapshot["ratingSpread"] - underdog_snapshot["ratingSpread"]) / 120
            + underdog_snapshot["upsetStyleScore"] * 0.25,
            0.12,
            0.95,
        )

        seed_upset = safe_int(winner_seed) > safe_int(loser_seed)
        winner_name = team_names.get(safe_int(row["WinnerID"]), str(safe_int(row["WinnerID"])))
        loser_name = team_names.get(safe_int(row["LoserID"]), str(safe_int(row["LoserID"])))
        game_id = (
            f"{safe_int(row['Season'])}-"
            f"{canonical_round(safe_int(row['DayNum'])).lower().replace(' ', '-')}-"
            f"{favorite_id}-{underdog_id}-{idx}"
        )

        matchup = {
            "gameId": game_id,
            "season": safe_int(row["Season"]),
            "dateLabel": f"Day {safe_int(row['DayNum'])}",
            "round": canonical_round(safe_int(row["DayNum"])),
            "roundOrder": round_sort_key(canonical_round(safe_int(row["DayNum"]))),
            "winnerTeamId": safe_int(row["WinnerID"]),
            "loserTeamId": safe_int(row["LoserID"]),
            "winner": winner_name,
            "loser": loser_name,
            "winnerSeed": safe_int(winner_seed),
            "loserSeed": safe_int(loser_seed),
            "winnerScore": safe_int(row["WinnerScore"]),
            "loserScore": safe_int(row["LoserScore"]),
            "favoriteTeamId": favorite_id,
            "favorite": favorite_name,
            "favoriteSeed": favorite_seed,
            "underdogTeamId": underdog_id,
            "underdog": underdog_name,
            "underdogSeed": underdog_seed,
            "favoriteWon": favorite_won,
            "seedUpset": seed_upset,
            "marketUpset": None,
            "modelUpset": False,
            "seedGap": underdog_seed - favorite_seed,
            "volatility": round(volatility, 3),
            "confidence": 0.0,
            "featureSnapshot": {
                "favorite": favorite_snapshot,
                "underdog": underdog_snapshot,
                "matchup": matchup_snapshot,
            },
            "postgameSwingFactors": build_postgame_swings(row, winner_name, loser_name),
            "sourceProvenance": [
                {
                    "label": "Kaggle March Machine Learning Mania 2026 data",
                    "url": "https://www.kaggle.com/competitions/march-machine-learning-mania-2026/data",
                }
            ],
        }
        matchups.append(matchup)

    matchups.sort(key=lambda item: (item["season"], item["roundOrder"], item["gameId"]))
    assign_model_probabilities(matchups)

    team_profile_records = []
    for _, row in profiles.iterrows():
        team_profile_records.append(
            {
                "season": safe_int(row["Season"]),
                "teamId": safe_int(row["TeamID"]),
                "team": team_names.get(safe_int(row["TeamID"]), str(safe_int(row["TeamID"]))),
                "games": safe_int(row["games"]),
                "wins": safe_int(row["wins"]),
                "winPct": round(safe_float(row["win_pct"]), 3),
                "offRating": round(safe_float(row["off_rating"]), 2),
                "defRating": round(safe_float(row["def_rating"]), 2),
                "netRating": round(safe_float(row["net_rating"]), 2),
                "threeRate": round(safe_float(row["three_rate"]), 3),
                "turnoverRate": round(safe_float(row["turnover_rate"]), 3),
                "offensiveReboundRate": round(safe_float(row["off_reb_rate"]), 3),
                "ftaRate": round(safe_float(row["fta_rate"]), 3),
                "ratingMean": round(safe_float(row["rating_mean"], 175.0), 2),
                "ratingBest": round(safe_float(row["rating_best"], 175.0), 2),
                "systems": safe_int(row["systems"]),
                "recentNetRating": round(safe_float(row.get("recent10_recent_net_rating")), 2),
                "recentWinPct": round(safe_float(row.get("recent10_recent_win_pct")), 3),
                "conference": row.get("conference") or None,
                "coach": row.get("coach") or None,
            }
        )

    for matchup in matchups:
        favorite_signals, underdog_signals = build_signals(matchup)
        matchup["topSignals"] = [asdict(signal) for signal in favorite_signals]
        matchup["upsetSignals"] = [asdict(signal) for signal in underdog_signals]
        build_outcome_text(matchup, favorite_signals, underdog_signals)
        matchup["editorialNotes"] = build_editorial_notes(matchup)
        matchup["riskFlags"] = [
            flag
            for flag, condition in [
                ("model-upset", matchup["modelUpset"]),
                ("seed-upset", matchup["seedUpset"]),
                ("high-volatility", matchup["volatility"] >= 0.65),
                ("coin-flip", 0.44 <= matchup["favoriteWinProbability"] <= 0.56),
                ("bracket-breaker", matchup["seedUpset"] and matchup["favoriteWinProbability"] >= 0.75),
            ]
            if condition
        ]

    choose_analogs(matchups)

    summary = {
        "games": len(matchups),
        "upsets": sum(1 for matchup in matchups if matchup["seedUpset"]),
        "seasons": sorted({matchup["season"] for matchup in matchups}),
        "latestSeason": max(matchup["season"] for matchup in matchups),
    }

    upset_candidates = [
        matchup
        for matchup in matchups
        if matchup["season"] >= 2024
        and matchup["round"] in {"Round of 64", "Round of 32", "First Four"}
        and (matchup["upsetLikelihood"] >= 0.35 or matchup["seedGap"] >= 6)
    ]
    upset_candidates.sort(
        key=lambda item: (-item["upsetLikelihood"], -item["volatility"], -item["seedGap"], item["gameId"])
    )

    return {
        "summary": summary,
        "games": matchups,
        "upsetCandidates": upset_candidates[:24],
        "teamProfiles": team_profile_records,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def build_demo_dataset() -> dict[str, Any]:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    return {
        "summary": {
            "games": 3,
            "upsets": 2,
            "seasons": [2024, 2025, 2026],
            "latestSeason": 2026,
        },
        "games": [
            {
                "gameId": "2024-round-of-64-kentucky-oakland",
                "season": 2024,
                "dateLabel": "Mar. 21, 2024",
                "round": "Round of 64",
                "roundOrder": 1,
                "winnerTeamId": 1001,
                "loserTeamId": 1002,
                "winner": "Oakland",
                "loser": "Kentucky",
                "winnerSeed": 14,
                "loserSeed": 3,
                "winnerScore": 80,
                "loserScore": 76,
                "favoriteTeamId": 1002,
                "favorite": "Kentucky",
                "favoriteSeed": 3,
                "underdogTeamId": 1001,
                "underdog": "Oakland",
                "underdogSeed": 14,
                "favoriteWon": False,
                "seedUpset": True,
                "marketUpset": None,
                "modelUpset": True,
                "seedGap": 11,
                "favoriteWinProbability": 0.83,
                "upsetLikelihood": 0.17,
                "volatility": 0.72,
                "confidence": 0.77,
                "topSignals": [
                    asdict(
                        Signal(
                            label="Season-long efficiency edge",
                            direction="favorite",
                            value="+11.2",
                            strength=0.74,
                            detail="Kentucky had the stronger full-season efficiency profile.",
                        )
                    )
                ],
                "upsetSignals": [
                    asdict(
                        Signal(
                            label="Three-point eruption path",
                            direction="underdog",
                            value="+8.1 pts",
                            strength=0.81,
                            detail="Oakland's perimeter volume created real upset variance.",
                        )
                    )
                ],
                "templateExplanation": "Kentucky profiled as the steadier side, but Oakland had enough real pregame warning signs to crack the matchup.",
                "favoriteCaseSummary": "Kentucky looked safer because of the season-long efficiency edge and seed-line control.",
                "underdogCaseSummary": "Oakland had a live path through three-point volatility.",
                "outcomeNarrative": "The upset landed after the underdog path proved more important than the seed line.",
                "modelBlindSpot": "The model likely understated how much perimeter variance could narrow the practical gap.",
                "outcomeTier": "seed-upset",
                "featureSnapshot": {
                    "favorite": {"team": "Kentucky", "seed": 3},
                    "underdog": {"team": "Oakland", "seed": 14},
                    "matchup": {"seed_gap": 11, "data_completeness": 0.8},
                },
                "postgameSwingFactors": ["Oakland won the shotmaking battle."],
                "editorialNotes": [
                    {
                        "tag": "shotmaking",
                        "summary": "The statistical warning was variance rather than balance: Oakland had a clear one-game ceiling outcome from deep.",
                        "confidence": 0.77,
                        "sources": [
                            {
                                "label": "NCAA upset history",
                                "url": "https://www.ncaa.com/news/basketball-men/article/2025-03-22/history-3-seeds-vs-14-seeds-march-madness",
                            }
                        ],
                    }
                ],
                "historicalAnalogs": [],
                "riskFlags": ["model-upset", "seed-upset", "bracket-breaker"],
                "sourceProvenance": [
                    {
                        "label": "NCAA upset history",
                        "url": "https://www.ncaa.com/news/basketball-men/article/2025-03-22/history-3-seeds-vs-14-seeds-march-madness",
                    }
                ],
            },
            {
                "gameId": "2025-round-of-64-12v5-demo",
                "season": 2025,
                "dateLabel": "Mar. 20, 2025",
                "round": "Round of 64",
                "roundOrder": 1,
                "winnerTeamId": 1003,
                "loserTeamId": 1004,
                "winner": "Liberty",
                "loser": "Oregon",
                "winnerSeed": 12,
                "loserSeed": 5,
                "winnerScore": 73,
                "loserScore": 70,
                "favoriteTeamId": 1004,
                "favorite": "Oregon",
                "favoriteSeed": 5,
                "underdogTeamId": 1003,
                "underdog": "Liberty",
                "underdogSeed": 12,
                "favoriteWon": False,
                "seedUpset": True,
                "marketUpset": None,
                "modelUpset": False,
                "seedGap": 7,
                "favoriteWinProbability": 0.58,
                "upsetLikelihood": 0.42,
                "volatility": 0.64,
                "confidence": 0.62,
                "topSignals": [],
                "upsetSignals": [],
                "templateExplanation": "This was the type of 12-5 game where the favorite's edge was real but thin enough to invite variance.",
                "favoriteCaseSummary": "Oregon held the cleaner bracket case.",
                "underdogCaseSummary": "Liberty had the usual 12-seed variance path.",
                "outcomeNarrative": "This was closer to a live upset than a true shock.",
                "modelBlindSpot": None,
                "outcomeTier": "seed-upset",
                "featureSnapshot": {
                    "favorite": {"team": "Oregon", "seed": 5},
                    "underdog": {"team": "Liberty", "seed": 12},
                    "matchup": {"seed_gap": 7, "data_completeness": 0.8},
                },
                "postgameSwingFactors": [],
                "editorialNotes": [],
                "historicalAnalogs": ["2024-round-of-64-kentucky-oakland"],
                "riskFlags": ["seed-upset"],
                "sourceProvenance": [],
            },
            {
                "gameId": "2026-round-of-64-12v5-candidate",
                "season": 2026,
                "dateLabel": "Mar. 19, 2026",
                "round": "Round of 64",
                "roundOrder": 1,
                "winnerTeamId": 1005,
                "loserTeamId": 1006,
                "winner": "Drake",
                "loser": "Missouri",
                "winnerSeed": 12,
                "loserSeed": 5,
                "winnerScore": 68,
                "loserScore": 66,
                "favoriteTeamId": 1006,
                "favorite": "Missouri",
                "favoriteSeed": 5,
                "underdogTeamId": 1005,
                "underdog": "Drake",
                "underdogSeed": 12,
                "favoriteWon": False,
                "seedUpset": True,
                "marketUpset": None,
                "modelUpset": True,
                "seedGap": 7,
                "favoriteWinProbability": 0.55,
                "upsetLikelihood": 0.45,
                "volatility": 0.69,
                "confidence": 0.59,
                "topSignals": [],
                "upsetSignals": [],
                "templateExplanation": "The favorite's edge was narrow enough that a steady underdog could turn the game into a possession-for-possession squeeze.",
                "favoriteCaseSummary": "Missouri had the better baseline numbers.",
                "underdogCaseSummary": "Drake had a live path through ball security and game control.",
                "outcomeNarrative": "This matchup fits the exact profile the site should surface as a live first-round upset candidate.",
                "modelBlindSpot": None,
                "outcomeTier": "seed-upset",
                "featureSnapshot": {
                    "favorite": {"team": "Missouri", "seed": 5},
                    "underdog": {"team": "Drake", "seed": 12},
                    "matchup": {"seed_gap": 7, "data_completeness": 0.8},
                },
                "postgameSwingFactors": [],
                "editorialNotes": [
                    {
                        "tag": "2026-candidate",
                        "summary": "This matchup fits the exact profile the site should surface as a live first-round upset candidate.",
                        "confidence": 0.8,
                        "sources": [
                            {
                                "label": "Official NCAA schedule",
                                "url": "https://www.ncaa.com/news/basketball-men/article/2025-03-19/2025-march-madness-mens-ncaa-tournament-schedule-dates",
                            }
                        ],
                    }
                ],
                "historicalAnalogs": ["2025-round-of-64-12v5-demo"],
                "riskFlags": ["seed-upset"],
                "sourceProvenance": [],
            },
        ],
        "upsetCandidates": [],
        "teamProfiles": [],
        "generatedAt": now,
    }


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    required = [
        RAW / "MTeams.csv",
        RAW / "MNCAATourneySeeds.csv",
        RAW / "MNCAATourneyDetailedResults.csv",
        RAW / "MRegularSeasonDetailedResults.csv",
        RAW / "MMasseyOrdinals.csv",
    ]
    if all(path.exists() for path in required):
        import pandas as pd

        globals()["pd"] = pd
        print("build_dataset.py: using full raw ingestion mode", file=sys.stderr)
        dataset = build_dataset()
    else:
        missing = [path.name for path in required if not path.exists()]
        print("build_dataset.py: using starter fallback dataset", file=sys.stderr)
        print(f"build_dataset.py: missing raw files: {', '.join(missing)}", file=sys.stderr)
        dataset = build_demo_dataset()

    dataset = json_safe(dataset)
    output_path = PROCESSED / "dataset.json"
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(dataset, handle, indent=2, allow_nan=False)
    print(
        "build_dataset.py: wrote "
        f"{dataset['summary']['games']} games and {dataset['summary']['upsets']} upsets to {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
