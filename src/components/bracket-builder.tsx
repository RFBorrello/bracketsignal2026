"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { finalFourSlots, regionBrackets } from "@/lib/2026-bracket";
import {
  BRACKET_STORAGE_KEY,
  emptyBracketState,
  getSlotTeams,
  getWinningTeam,
  setPick,
  teamKey,
  toggleWatchlist,
} from "@/lib/bracket";
import { percent } from "@/lib/format";
import { BracketSlot, BracketState, MatchupPreview } from "@/lib/types";

function useBracketState() {
  const [state, setState] = useState<BracketState>(emptyBracketState);

  useEffect(() => {
    const raw = window.localStorage.getItem(BRACKET_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as BracketState;
      setState(parsed);
    } catch {
      window.localStorage.removeItem(BRACKET_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(BRACKET_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
}

function SlotCard({
  slot,
  state,
  onSelect,
  onOpenAnalysis,
  hasAnalysis,
  isAnalysisActive,
  liveRecordByTeam,
}: {
  slot: BracketSlot;
  state: BracketState;
  onSelect: (slotId: string, selection: string) => void;
  onOpenAnalysis?: (slotId: string) => void;
  hasAnalysis?: boolean;
  isAnalysisActive?: boolean;
  liveRecordByTeam: Map<string, string>;
}) {
  const [topTeam, bottomTeam] = getSlotTeams(slot.id, state);
  const displayTopTeam =
    topTeam && liveRecordByTeam.has(topTeam.name) ? { ...topTeam, record: liveRecordByTeam.get(topTeam.name)! } : topTeam;
  const displayBottomTeam =
    bottomTeam && liveRecordByTeam.has(bottomTeam.name) ? { ...bottomTeam, record: liveRecordByTeam.get(bottomTeam.name)! } : bottomTeam;
  const selected = state.picks[slot.id];

  if (!displayTopTeam || !displayBottomTeam) {
    return (
      <article className="slot-card slot-card--pending">
        <p>{slot.label}</p>
        <strong>Awaiting earlier picks</strong>
      </article>
    );
  }

  return (
    <article
      className={`slot-card ${hasAnalysis ? "slot-card--interactive" : ""} ${isAnalysisActive ? "slot-card--active" : ""}`}
      onClick={hasAnalysis && onOpenAnalysis ? () => onOpenAnalysis(slot.id) : undefined}
    >
      <p className="panel__kicker">
        {slot.region} · {slot.label}
      </p>
      {hasAnalysis ? <small className="slot-card__hint">Click anywhere on the matchup to open the analysis drawer.</small> : null}
      {[displayTopTeam, displayBottomTeam].map((team) => {
        const key = teamKey(team);
        return (
          <button
            type="button"
            key={key}
            className={`team-option ${selected === key ? "team-option--selected" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              if (hasAnalysis && onOpenAnalysis) {
                onOpenAnalysis(slot.id);
              }
              onSelect(slot.id, key);
            }}
          >
            <span>
              {team.seed}. {team.name}
            </span>
            <small>
              {team.conference} · {team.record}
            </small>
          </button>
        );
      })}
    </article>
  );
}

export function BracketBuilder({ matchups }: { matchups: MatchupPreview[] }) {
  const [state, setState] = useBracketState();
  const [activePreviewId, setActivePreviewId] = useState<string | null>(matchups[0]?.id ?? null);
  const matchupById = useMemo(() => new Map(matchups.map((preview) => [preview.id, preview])), [matchups]);
  const liveRecordByTeam = useMemo(() => {
    const next = new Map<string, string>();
    for (const matchup of matchups) {
      next.set(matchup.topTeam.name, matchup.topTeam.record);
      next.set(matchup.bottomTeam.name, matchup.bottomTeam.record);
    }
    return next;
  }, [matchups]);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarBodyRef = useRef<HTMLDivElement | null>(null);

  const activePreview = useMemo(
    () => matchups.find((preview) => preview.id === activePreviewId) ?? matchups[0],
    [activePreviewId, matchups],
  );

  useEffect(() => {
    sidebarBodyRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activePreviewId]);

  const openPreview = (previewId: string) => {
    setActivePreviewId(previewId);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        const sidebar = sidebarRef.current;
        if (!sidebar) {
          return;
        }
        const rect = sidebar.getBoundingClientRect();
        const offscreen = rect.bottom <= 0 || rect.top >= window.innerHeight || rect.top < 0;
        if (window.innerWidth <= 1100 || offscreen) {
          sidebar.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  };

  return (
    <div className="bracket-layout">
      <section className="stack-lg">
        {regionBrackets.map((region) => (
          <section key={region.region} className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__kicker">Region</p>
                <h2>{region.region}</h2>
              </div>
            </div>
            <div className="round-columns">
              {[1, 2, 3, 4].map((round) => (
                <div key={`${region.region}-${round}`} className="round-column">
                  <p className="round-column__label">
                    {round === 1
                      ? "Round of 64"
                      : round === 2
                        ? "Round of 32"
                        : round === 3
                          ? "Sweet 16"
                          : "Elite Eight"}
                  </p>
                  {region.slots
                    .filter((slot) => slot.round === round)
                    .map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        state={state}
                        hasAnalysis={matchupById.has(slot.id)}
                        isAnalysisActive={activePreview?.id === slot.id}
                        onOpenAnalysis={openPreview}
                        onSelect={(slotId, selection) => setState((current) => setPick(current, slotId, selection))}
                        liveRecordByTeam={liveRecordByTeam}
                      />
                    ))}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Final Four</p>
              <h2>Championship path</h2>
            </div>
          </div>
          <div className="round-columns round-columns--final">
            {finalFourSlots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                state={state}
                onSelect={(slotId, selection) => setState((current) => setPick(current, slotId, selection))}
                liveRecordByTeam={liveRecordByTeam}
              />
            ))}
          </div>
          <div className="champion-banner">
            <span>Projected champion</span>
            <strong>{getWinningTeam("title-game", state)?.name ?? "Make your picks"}</strong>
          </div>
        </section>
      </section>

      <div className="bracket-sidebar-shell">
        <aside ref={sidebarRef} className="panel bracket-sidebar">
          <div className="panel__header">
            <div>
              <p className="panel__kicker">Matchup drawer</p>
              <h2>Decision support</h2>
            </div>
          </div>

          {activePreview ? (
            <div ref={sidebarBodyRef} className="bracket-sidebar__body stack-md">
              <div className="candidate-card candidate-card--sidebar">
                <p className="panel__kicker">
                  {activePreview.region} · {activePreview.round}
                </p>
                <h3>
                  {activePreview.underdogTeam} over {activePreview.favoriteTeam}
                </h3>
                <p>{activePreview.summary}</p>
                <div className="stat-grid">
                  <div className="stat-pill stat-pill--alert">
                    <span>Upset likelihood</span>
                    <strong>{percent(activePreview.upsetLikelihood)}</strong>
                  </div>
                  <div className="stat-pill stat-pill--favorite">
                    <span>Favorite win</span>
                    <strong>{percent(activePreview.favoriteWinProbability)}</strong>
                  </div>
                  <div className="stat-pill">
                    <span>Volatility</span>
                    <strong>{percent(activePreview.volatility)}</strong>
                  </div>
                </div>
                <p className="muted">{activePreview.underdogCaseSummary}</p>
                <div className="stack-sm">
                  <p className="panel__kicker">Qualitative indicators</p>
                  {activePreview.editorialNotes.slice(0, 3).map((note) => (
                    <div key={`${note.tag}-${note.summary}`} className="insight-note">
                      <strong>{note.tag}</strong>
                      <small>{note.summary}</small>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setState((current) => toggleWatchlist(current, activePreview.id))}
                >
                  {state.upsetWatchlist.includes(activePreview.id) ? "Remove from watchlist" : "Add to watchlist"}
                </button>
              </div>
              <div className="stack-sm">
                <p className="panel__kicker">Why the underdog is live</p>
                {activePreview.tags.map((tag) => (
                  <span key={tag.label} className={`chip chip--${tag.tone}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
              <div className="stack-sm">
                <p className="panel__kicker">Bracket baseline</p>
                <div className="comparison-table">
                  <div className="comparison-table__header">
                    <span>{activePreview.favoriteTeam}</span>
                    <span>Indicator</span>
                    <span>{activePreview.underdogTeam}</span>
                  </div>
                  {activePreview.comparisonRows.map((row) => (
                    <article key={row.label} className={`comparison-row comparison-row--${row.lean}`}>
                      <strong>{row.favoriteValue}</strong>
                      <div>
                        <span>{row.label}</span>
                        <small>{row.rationale}</small>
                      </div>
                      <strong>{row.underdogValue}</strong>
                    </article>
                  ))}
                </div>
              </div>
              {activePreview.statComparisonRows.length > 0 ? (
                <div className="stack-sm">
                  <p className="panel__kicker">
                    {activePreview.statSnapshotUpdated
                      ? "2026 current-season stats"
                      : activePreview.statProfileSeason
                        ? `Latest profile stats (${activePreview.statProfileSeason})`
                        : "Team stat profile"}
                  </p>
                  {activePreview.statSnapshotUpdated ? <span className="badge">{activePreview.statSnapshotUpdated}</span> : null}
                  <div className="comparison-table">
                    <div className="comparison-table__header">
                      <span>{activePreview.favoriteTeam}</span>
                      <span>Metric</span>
                      <span>{activePreview.underdogTeam}</span>
                    </div>
                    {activePreview.statComparisonRows.map((row) => (
                      <article key={`stat-${row.label}`} className={`comparison-row comparison-row--${row.lean}`}>
                        <strong>{row.favoriteValue}</strong>
                        <div>
                          <span>{row.label}</span>
                          <small>{row.rationale}</small>
                        </div>
                        <strong>{row.underdogValue}</strong>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="stack-sm">
                <p className="panel__kicker">Watchlist</p>
                <div className="watchlist watchlist--sidebar">
                  {matchups.map((preview) => {
                    const active = state.upsetWatchlist.includes(preview.id);
                    return (
                      <button
                        type="button"
                        key={preview.id}
                        className={`watchlist-card ${activePreview?.id === preview.id ? "watchlist-card--active" : ""}`}
                        onClick={() => openPreview(preview.id)}
                      >
                        <div>
                          <strong>
                            {preview.bottomTeam.seed}/{preview.topTeam.seed} {preview.underdogTeam} vs {preview.favoriteTeam}
                          </strong>
                          <small>
                            {preview.region} · {percent(preview.upsetLikelihood)}
                          </small>
                        </div>
                        <span className={`badge ${active ? "badge--alert" : ""}`}>
                          {active ? "Watching" : "Open"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
