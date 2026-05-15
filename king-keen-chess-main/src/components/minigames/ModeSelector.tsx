import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Users, Globe } from "lucide-react";
import type { GameMeta } from "@/lib/minigames/registry";
import type { Difficulty, PlayMode } from "@/lib/minigames/types";
import { cn } from "@/lib/utils";

const MODES: Array<{ id: PlayMode; label: string; icon: typeof Bot; desc: string }> = [
  { id: "ai", label: "vs AI", icon: Bot, desc: "Play against the computer" },
  { id: "local", label: "Local 2-Player", icon: Users, desc: "Pass & play on one device" },
  { id: "online", label: "Online", icon: Globe, desc: "Quick match or private room" },
];

export function ModeSelector({
  game, mode, setMode, difficulty, setDifficulty, onStart, onBack,
}: {
  game: GameMeta;
  mode: PlayMode;
  setMode: (m: PlayMode) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  const av = game.modes[mode];
  return (
    <Card className="mx-auto max-w-md p-6 space-y-5">
      <div className="text-center space-y-1">
        <div className="text-4xl">{game.emoji}</div>
        <h2 className="text-xl font-bold">{game.title}</h2>
        <p className="text-xs text-muted-foreground">{game.blurb}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Mode</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {MODES.map(({ id, label, icon: Icon, desc }) => {
            const a = game.modes[id];
            return (
              <button
                key={id}
                disabled={!a.available}
                title={a.reason}
                onClick={() => setMode(id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  mode === id ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-border bg-card hover:bg-accent/30",
                  !a.available && "opacity-40 cursor-not-allowed",
                )}
              >
                <Icon className="h-4 w-4 mb-1 text-primary" />
                <div className="text-sm font-medium">{label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{a.available ? desc : a.reason}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Difficulty</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <Button key={d} variant={difficulty === d ? "default" : "secondary"} size="sm" onClick={() => setDifficulty(d)}>
              {d[0].toUpperCase() + d.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={onStart} disabled={!av.available} className="flex-1">Start</Button>
      </div>
    </Card>
  );
}
