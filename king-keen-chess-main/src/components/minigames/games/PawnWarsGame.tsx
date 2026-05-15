import { useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { pawnAi } from "@/lib/minigames/ai";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";

function buildFen(): string {
  const c = new Chess();
  c.clear();
  for (let f = 0; f < 8; f++) {
    c.put({ type: "p", color: "w" }, ("abcdefgh"[f] + "2") as Square);
    c.put({ type: "p", color: "b" }, ("abcdefgh"[f] + "7") as Square);
  }
  // Need kings for chess.js — place them off in corners and ignore
  c.put({ type: "k", color: "w" }, "h1");
  c.put({ type: "k", color: "b" }, "a8");
  return c.fen();
}

function checkPromotion(c: Chess, color: "w" | "b") {
  const board = c.board();
  for (let f = 0; f < 8; f++) {
    const r = color === "w" ? 0 : 7;
    const sq = board[r][f];
    if (sq?.type === "p" && sq.color === color) return true;
    // After promotion chess.js will have replaced it; check for queen/knight/etc on back rank
    if (sq && sq.type !== "k" && sq.color === color && r === (color === "w" ? 0 : 7)) return true;
  }
  return false;
}

export function PawnWarsGame({
  mode, difficulty, room, color, onFinish,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  room?: RoomRow;
  color: "w" | "b";
  onFinish: (won: boolean, stars: number) => void;
}) {
  const chessRef = useRef(new Chess(buildFen()));
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
    if (checkPromotion(chessRef.current, "w")) { onFinish(color === "w", color === "w" ? 3 : 0); return true; }
    if (checkPromotion(chessRef.current, "b")) { onFinish(color === "b", color === "b" ? 3 : 0); return true; }
    return false;
  }

  function aiMove() {
    setTimeout(() => {
      const m = pawnAi(chessRef.current.fen(), difficulty);
      if (m) { chessRef.current.move(m); force((x) => x + 1); checkWin(); }
    }, 300);
  }

  function broadcast() {
    channelRef.current?.send({ type: "broadcast", event: "mg", payload: { type: "move", fen: chessRef.current.fen() } });
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare) return false;
    const c = chessRef.current;
    if ((mode === "online" || mode === "ai") && c.turn() !== color) return false;
    const m = c.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
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
      }} />
      <p className="mt-2 text-center text-xs text-muted-foreground">First pawn to the back rank wins.</p>
    </Card>
  );
}
