import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getGame } from "@/lib/minigames/registry";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";
import { ModeSelector } from "@/components/minigames/ModeSelector";
import { OnlineWaitingRoom } from "@/components/minigames/OnlineWaitingRoom";
import { MiniGameResultModal } from "@/components/minigames/MiniGameResultModal";
import { KnightsTourGame } from "@/components/minigames/games/KnightsTourGame";
import { KingOfTheHillGame } from "@/components/minigames/games/KingOfTheHillGame";
import { PawnWarsGame } from "@/components/minigames/games/PawnWarsGame";
import { FogOfWarGame } from "@/components/minigames/games/FogOfWarGame";
import { PieceSurvivalGame } from "@/components/minigames/games/PieceSurvivalGame";
import { recordScore } from "@/lib/minigames/scoring";
import { markFinished } from "@/lib/minigames/online";

export const Route = createFileRoute("/minigames/$game")({
  component: GamePage,
  head: () => ({ meta: [{ title: "Play Mini Game — Knight Chess" }] }),
});

type Stage = "select" | "waiting" | "playing" | "done";

// BUG FIX: Pick the first available mode for this game synchronously.
// The old code defaulted to "ai" which is unavailable for Knight's Tour,
// keeping the Start button permanently disabled.
function firstAvailableMode(gameId: string): PlayMode {
  const meta = getGame(gameId);
  if (!meta) return "ai";
  const order: PlayMode[] = ["ai", "local", "online"];
  return order.find((m) => meta.modes[m].available) ?? "online";
}

function GamePage() {
  const { game } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const meta = getGame(game);

  // Initialise to the first AVAILABLE mode for this specific game
  const [stage, setStage] = useState<Stage>("select");
  const [mode, setMode] = useState<PlayMode>(() => firstAvailableMode(game));
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [color, setColor] = useState<"w" | "b">("w");
  const [result, setResult] = useState<{ won: boolean; stars: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  // Also reset to a valid mode if the user somehow navigates between games
  useEffect(() => {
    setMode(firstAvailableMode(game));
    setStage("select");
    setResult(null);
    setRoom(null);
  }, [game]);

  if (!meta) return (
    <p className="p-6">
      Unknown mini-game. <Link to="/minigames" className="underline">Back</Link>
    </p>
  );
  if (!user) return null;

  const onFinish = async (won: boolean, stars: number, timeSec?: number) => {
    setResult({ won, stars });
    setStage("done");
    if (user) {
      await recordScore({
        userId: user.id, gameType: meta.id, mode, difficulty,
        stars, completionTimeSeconds: timeSec, won,
      });
    }
    if (room) await markFinished(room.room_code).catch(() => {});
  };

  const replay = () => {
    setResult(null);
    setRoom(null);
    setStage("select");
  };

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/minigames"><ArrowLeft className="h-4 w-4 mr-1" />Hub</Link>
          </Button>
          <h1 className="text-lg font-bold">{meta.emoji} {meta.title}</h1>
          <span className="w-16" />
        </header>

        {stage === "select" && (
          <ModeSelector
            game={meta}
            mode={mode}
            setMode={setMode}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            onStart={() => {
              if (mode === "online") setStage("waiting");
              else setStage("playing");
            }}
            onBack={() => nav({ to: "/minigames" })}
          />
        )}

        {stage === "waiting" && (
          <OnlineWaitingRoom
            gameType={meta.id}
            difficulty={difficulty}
            onReady={(r, c) => { setRoom(r); setColor(c); setStage("playing"); }}
            onCancel={() => setStage("select")}
          />
        )}

        {stage === "playing" && (
          <div className="space-y-3">
            {meta.id === "knights-tour" && (
              <KnightsTourGame
                mode={mode} difficulty={difficulty}
                room={room ?? undefined} onFinish={onFinish}
              />
            )}
            {meta.id === "king-of-the-hill" && (
              <KingOfTheHillGame
                mode={mode} difficulty={difficulty}
                room={room ?? undefined} color={color} onFinish={onFinish}
              />
            )}
            {meta.id === "pawn-wars" && (
              <PawnWarsGame
                mode={mode} difficulty={difficulty}
                room={room ?? undefined} color={color} onFinish={onFinish}
              />
            )}
            {meta.id === "fog-of-war" && (
              <FogOfWarGame
                mode={mode} difficulty={difficulty}
                room={room ?? undefined} color={color} onFinish={onFinish}
              />
            )}
            {meta.id === "piece-survival" && (
              <PieceSurvivalGame
                mode={mode} difficulty={difficulty}
                room={room ?? undefined} color={color} onFinish={onFinish}
              />
            )}
          </div>
        )}

        <MiniGameResultModal
          open={stage === "done" && !!result}
          won={result?.won ?? false}
          stars={result?.stars ?? 0}
          message={result?.won ? "Great play!" : "Better luck next time."}
          onReplay={replay}
          onExit={() => nav({ to: "/minigames" })}
        />
      </div>
    </main>
  );
}
