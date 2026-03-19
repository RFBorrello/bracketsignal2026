import { finalFourSlots, regionBrackets } from "@/lib/2026-bracket";
import { BracketState, BracketSlot, RegionBracket, TeamSeed } from "@/lib/types";

export const BRACKET_STORAGE_KEY = "ncaamodel-bracket-state-v1";

export const emptyBracketState = (): BracketState => ({
  version: 1,
  picks: {},
  upsetWatchlist: [],
});

export const allBracketSlots = [...regionBrackets.flatMap((region) => region.slots), ...finalFourSlots];

const slotMap = new Map(allBracketSlots.map((slot) => [slot.id, slot]));

export function getSlot(slotId: string): BracketSlot | undefined {
  return slotMap.get(slotId);
}

export function teamKey(team: TeamSeed | undefined): string {
  return team ? `${team.seed}-${team.name}` : "";
}

export function getSlotTeams(slotId: string, state: BracketState): [TeamSeed | undefined, TeamSeed | undefined] {
  const slot = getSlot(slotId);
  if (!slot) {
    return [undefined, undefined];
  }
  if (slot.round === 1) {
    return [slot.topTeam, slot.bottomTeam];
  }
  if (!slot.children) {
    return [undefined, undefined];
  }
  return slot.children.map((childId) => getWinningTeam(childId, state)) as [TeamSeed | undefined, TeamSeed | undefined];
}

export function getWinningTeam(slotId: string, state: BracketState): TeamSeed | undefined {
  const slot = getSlot(slotId);
  if (!slot) {
    return undefined;
  }
  const [topTeam, bottomTeam] = getSlotTeams(slotId, state);
  const pick = state.picks[slotId];
  if (!pick) {
    return undefined;
  }
  const topKey = teamKey(topTeam);
  if (pick === topKey) {
    return topTeam;
  }
  const bottomKey = teamKey(bottomTeam);
  if (pick === bottomKey) {
    return bottomTeam;
  }
  return undefined;
}

export function setPick(state: BracketState, slotId: string, selectedKey: string): BracketState {
  const nextState: BracketState = {
    ...state,
    picks: { ...state.picks, [slotId]: selectedKey },
  };
  return pruneInvalidDescendants(nextState, slotId);
}

function pruneInvalidDescendants(state: BracketState, changedSlotId: string): BracketState {
  const next = { ...state, picks: { ...state.picks } };
  const queue = [changedSlotId];
  const descendants = allBracketSlots.filter((slot) => slot.children?.includes(changedSlotId));

  for (const slot of descendants) {
    queue.push(slot.id);
  }

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const slot of allBracketSlots.filter((candidate) => candidate.children?.includes(parentId))) {
      const [topTeam, bottomTeam] = getSlotTeams(slot.id, next);
      const validKeys = new Set([teamKey(topTeam), teamKey(bottomTeam)].filter(Boolean));
      if (!validKeys.has(next.picks[slot.id])) {
        delete next.picks[slot.id];
      }
      queue.push(slot.id);
    }
  }

  return next;
}

export function toggleWatchlist(state: BracketState, matchupId: string): BracketState {
  const next = new Set(state.upsetWatchlist);
  if (next.has(matchupId)) {
    next.delete(matchupId);
  } else {
    next.add(matchupId);
  }
  return {
    ...state,
    upsetWatchlist: [...next],
  };
}

export function regionRoundOne(region: RegionBracket): BracketSlot[] {
  return region.slots.filter((slot) => slot.round === 1);
}
