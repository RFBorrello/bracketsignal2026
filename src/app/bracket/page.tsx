import { BracketBuilder } from "@/components/bracket-builder";
import { SiteShell } from "@/components/site-shell";
import { getTournament2026Matchups } from "@/lib/data";

export default function BracketPage() {
  const matchups = getTournament2026Matchups();

  return (
    <SiteShell eyebrow="Interactive Bracket Builder" title="Make picks with the evidence pinned beside the board.">
      <p className="page-lede">
        Picks persist in local browser storage. Upset candidates stay visible alongside the bracket so you can move
        from matchup analysis into round-by-round decisions without losing context.
      </p>
      <BracketBuilder matchups={matchups} />
    </SiteShell>
  );
}
