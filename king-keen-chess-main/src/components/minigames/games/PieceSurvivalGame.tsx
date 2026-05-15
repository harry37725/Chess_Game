import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { hunterAi } from "@/lib/minigames/ai";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";

function buildFen(difficulty: Difficulty, hunterColor: "w" | "b" = "b"): string {
  const c = new Chess();
  c.clear();
  // Survivor (white) full setup minus king on appropriate squares
  // Place a full set of white pieces:
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"] as const;
  for (let f = 0; f < 8; f++) {
    c.put({ type: back[f] as any, color: "w" }, ("abcdefgh"[f] + "1") as Square);
    c.put({ type: "p", color: "w" }, ("abcdefgh"[f] + "2") as Square);
  }
  // Hunter pieces on rank 8
  if (difficulty === "easy") c.put({ type: "r", color: hunterColor }, "d8");
  else if (difficulty === "medium") c.put({ type: "q", color: hunterColor }, "d8");
  else { c.put({ type: "q", color: hunterColor }, "d8"); c.put({ type: "r", color: hunterColor }, "h8"); }
  c.put({ type: "k", color: hunterColor }, "e8");
  return c.fen();
}

const SURVIVE_MOVES = 10;

export function PieceSurvivalGame({
  mode, difficulty, room, color, onFinish,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  room?: RoomRow;
  color: "w" | "b"; // your color (survivor=w, hunter=b by default)
  onFinish: (won: boolean, stars: number) => void;
}) {
  const chessRef = useRef(new Chess(buildFen(difficulty)));
  const [, force] = useState(0);
  const [hunterMoves, setHunterMoves] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myRole: "survivor" | "hunter" = color === "w" ? "survivor" : "hunter";

  useEffect(() => {
    if (mode !== "online" || !room) return;
    const ch = supabase.channel(`mg:${room.room_code}`);
    channelRef.current = ch;
    ch.on("broadcast", { event: "mg" }, ({ payload }) => {
      if (payload?.type === "move" && payload.fen) {
        try { chessRef.current.load(payload.fen); force((x) => x + 1); afterMove(); } catch {}
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode, room]);

  function survivorAlive(): boolean {
    const board = chessRef.current.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.color === "w" && p.type !== "k") return true;
    }
    return false;
  }

  function afterMove() {
    if (!survivorAlive()) {
      onFinish(myRole === "hunter", myRole === "hunter" ? 3 : 0);
      return true;
    }
    if (chessRef.current.turn() === "w") {
      // hunter just moved
      const next = hunterMoves + 1;
      setHunterMoves(next);
      if (next >= SURVIVE_MOVES) {
        onFinish(myRole === "survivor", myRole === "survivor" ? 3 : 0);
        return true;
      }
    }
    return false;
  }

  function broadcast() {
    channelRef.current?.send({ type: "broadcast", event: "mg", payload: { type: "move", fen: chessRef.current.fen() } });
  }

  function aiMove() {
    setTimeout(() => {
      // AI plays as hunter (black)
      const m = hunterAi(chessRef.current.fen());
      if (m) { chessRef.current.move(m); force((x) => x + 1); afterMove(); }
    }, 350);
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare) return false;
    const c = chessRef.current;
    if ((mode === "online" || mode === "ai") && c.turn() !== color) return false;
    const m = c.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!m) return false;
    force((x) => x + 1);
    if (mode === "online") broadcast();
    if (afterMove()) return true;
    if (mode === "ai") aiMove();
    return true;
  }

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className={myRole === "hunter" ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
          {myRole === "hunter" ? "🏹 Hunt them down!" : "🛡️ Stay alive!"}
        </span>
        <span>Hunter moves: <b>{hunterMoves}</b> / {SURVIVE_MOVES}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-500 to-red-500 transition-all"
          style={{ width: `${(hunterMoves / SURVIVE_MOVES) * 100}%` }} />
      </div>
      <Chessboard options={{
        position: chessRef.current.fen(),
        onPieceDrop,
        boardOrientation: color === "w" ? "white" : "black",
        animationDurationInMs: 200,
        boardStyle: { borderRadius: 12 },
      }} />
    </Card>
  );
}
