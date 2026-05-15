import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Users, Crown, Globe, Sparkles, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export type Mode = "ai" | "local" | "spectate" | "online";

export type StartConfig = {
  mode: Mode;
  difficulty: number;
  color: "w" | "b";
  roomId?: string;
  ratingFilter?: number;
};

const MODE_OPTIONS: { id: Mode; label: string; desc: string; icon: typeof Bot }[] = [
  { id: "ai", label: "Play vs AI", desc: "Challenge the computer", icon: Bot },
  { id: "online", label: "Online Match", desc: "Play a random opponent", icon: Globe },
  { id: "local", label: "Local 2-Player", desc: "Pass & play on one device", icon: Users },
];

const DIFF = [
  { d: 2, label: "Easy" },
  { d: 3, label: "Medium" },
  { d: 4, label: "Hard" },
];

export function StartScreen({ onStart }: { onStart: (cfg: StartConfig) => void }) {
  const [mode, setMode] = useState<Mode>("ai");
  const [difficulty, setDifficulty] = useState(3);
  const [color, setColor] = useState<"w" | "b">("w");

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 sm:p-8 space-y-6 border-border">
        <div className="text-center space-y-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Crown className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold">New Game</h2>
          <p className="text-sm text-muted-foreground">Choose your mode and settings</p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Mode</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {MODE_OPTIONS.map(({ id, label, desc, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  mode === id
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-border bg-card hover:bg-accent/30"
                )}
              >
                <Icon className="h-5 w-5 mb-2 text-primary" />
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-muted-foreground mt-1">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {mode === "ai" && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Difficulty</h3>
              <div className="grid grid-cols-3 gap-2">
                {DIFF.map(({ d, label }) => (
                  <Button key={d} variant={difficulty === d ? "default" : "secondary"} onClick={() => setDifficulty(d)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Play as</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={color === "w" ? "default" : "secondary"} onClick={() => setColor("w")}>♔ White</Button>
                <Button variant={color === "b" ? "default" : "secondary"} onClick={() => setColor("b")}>♚ Black</Button>
              </div>
            </div>
          </>
        )}

        {mode === "online" && (
          <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">
            You'll be matched with a random online player. Your rating updates after each match based on the result and your opponent's rating (ELO).
          </p>
        )}

        <Button size="lg" className="w-full" onClick={() => onStart({ mode, difficulty, color })}>
          {mode === "online" ? "Find Match" : "Start Game"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-card px-2 text-muted-foreground">or improve your skills</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link to="/training"><Sparkles className="h-4 w-4" /> Train</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="gap-2">
            <Link to="/minigames"><Gamepad2 className="h-4 w-4" /> Mini Games</Link>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground text-center">5 unique chess challenges await in Mini Games</p>
      </Card>
    </div>
  );
}
