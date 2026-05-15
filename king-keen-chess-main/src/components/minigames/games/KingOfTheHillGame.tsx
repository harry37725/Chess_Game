import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { kingAi } from "@/lib/minigames/ai";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";

const CENTER: Square[] = ["d4", "e4", "d5", "e5"];

function buildFen(difficulty: Difficulty): string {
  // White king position varies by difficulty; black king on e8
  const wk = difficulty === "easy" ? "d3" : difficulty === "medium" ? "e1" : "a1";
  const c = new Chess();
  c.clear();
  c.put({ type: "k", color: "w" }, wk as Square);
  c.put({ type: "k", color: "b" }, "e8");
  // chess.js requires a king of each side; manually set turn to white
  return c.fen().replace(/ \w /, " w ");
}

export function KingOfTheHillGame({
  mode, difficulty, room, color, onFinish,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  room?: RoomRow;
  color: "w" | "b";
  onFinish: (won: boolean, stars: number) => void;
}) {
  const chessRef = useRef(new Chess(buildFen(difficulty)));
  const [, force] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (mode !== "online" || !room) return;
    const ch = supabase.channel(`mg:${room.room_code}`);
    channelRef.current = ch;
    ch.on("broadcast", { event: "mg" }, ({ payload }) => {
      if (payload?.type === "move" && payload.fen) {
        try { chessRef.current.load(payload.fen); force((x) => x + 1); checkWin(); } catch {}
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode, room]);

  function checkWin(): boolean {
    const c = chessRef.current;
    const board = c.board();
    for (const sq of CENTER) {
      const f = sq.charCodeAt(0) - 97;
      const r = 8 - parseInt(sq[1], 10);
      const piece = board[r][f];
      if (piece?.type === "k") {
        const winnerColor = piece.color;
        const youWin = (mode === "ai" || mode === "online") ? winnerColor === color : true;
        onFinish(youWin, youWin ? 3 : 1);
        return true;
      }
    }
    return false;
  }

  function aiMove() {
    setTimeout(() => {
      const m = kingAi(chessRef.current.fen());
      if (m) { chessRef.current.move(m); force((x) => x + 1); checkWin(); }
    }, 350);
  }

  function broadcast() {
    channelRef.current?.send({ type: "broadcast", event: "mg", payload: { type: "move", fen: chessRef.current.fen() } });
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare) return false;
    const c = chessRef.current;
    if (mode === "online" && c.turn() !== color) return false;
    if (mode === "ai" && c.turn() !== color) return false;
    const m = c.move({ from: sourceSquare, to: targetSquare });
    if (!m) return false;
    force((x) => x + 1);
    if (mode === "online") broadcast();
    if (checkWin()) return true;
    if (mode === "ai") aiMove();
    return true;
  }

  return (
    <Card className="p-3">
      <Chessboard options={{
        position: chessRef.current.fen(),
        onPieceDrop,
        boardOrientation: color === "w" ? "white" : "black",
        animationDurationInMs: 200,
        boardStyle: { borderRadius: 12 },
        squareStyles: Object.fromEntries(CENTER.map((s) => [s, { background: "radial-gradient(circle, gold, transparent 70%)" }])),
      }} />
      <p className="mt-2 text-center text-xs text-muted-foreground">Race to a golden center square — diagonals count!</p>
    </Card>
  );
}
