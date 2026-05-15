import { Star, Coins, Flame } from "lucide-react";
import type { Stats } from "@/lib/training/state";

export function Hud({ stats }: { stats: Stats | null }) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="mx-auto max-w-2xl px-3 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Training Zone</div>
        <div className="flex items-center gap-3">
          <Chip icon={<Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />} value={stats?.total_stars ?? 0} />
          <Chip icon={<Coins className="h-3.5 w-3.5 text-amber-400" />} value={stats?.coins ?? 0} />
          <Chip icon={<Flame className="h-3.5 w-3.5 text-orange-500" />} value={`${stats?.streak ?? 0}d`} />
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, value }: { icon: React.ReactNode; value: number | string }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/40 border border-border tabular-nums">
      {icon}<span className="font-semibold text-xs">{value}</span>
    </div>
  );
}
