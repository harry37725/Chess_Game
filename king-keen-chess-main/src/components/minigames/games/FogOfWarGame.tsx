import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { findBestMove } from "@/lib/chess-ai";
import { computeVision } from "@/lib/minigames/fog";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";

export function FogOfWarGame({
  mode, difficulty, room, color, onFinish,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  room?: RoomRow;
  color: "w" | "b";
  onFinish: (won: boolean, stars: number) => void;
}) {
  const chessRef = useRef(new Chess());
  const [, force] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Local hot-seat: viewerColor toggles each turn
  const [viewer, setViewer] = useState<"w" | "b">("w");
  const viewerColor: "w" | "b" = mode === "local" ? viewer : color;

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

  const visible = useMemo(
    () => computeVision(chessRef.current.fen(), viewerColor, difficulty),
    [chessRef.current.fen(), viewerColor, difficulty],
  );

  function checkWin(): boolean {
    const c = chessRef.current;
    if (c.isCheckmate()) {
      const loser = c.turn();
      const won = loser !== color;
      onFinish(won, won ? 3 : 1);
      return true;
    }
    return false;
  }

  function broadcast() {
    channelRef.current?.send({ type: "broadcast", event: "mg", payload: { type: "move", fen: chessRef.current.fen() } });
  }

  function aiMove() {
    setTimeout(() => {
      const m = findBestMove(chessRef.current.fen(), 2);
      if (m) { chessRef.current.move(m); force((x) => x + 1); checkWin(); }
    }, 300);
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare) return false;
    const c = chessRef.current;
    if (mode === "online" && c.turn() !== color) return false;
    if (mode === "ai" && c.turn() !== color) return false;
    const m = c.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!m) return false;
    force((x) => x + 1);
    if (mode === "online") broadcast();
    if (mode === "local") setViewer(c.turn());
    if (checkWin()) return true;
    if (mode === "ai") aiMove();
    return true;
  }

  // Build an overlay of solid black tiles for hidden squares.
  // We render this ABOVE the chessboard pieces so opponent pieces are
  // completely concealed (squareStyles alone sit behind the piece layer).
  const hiddenSquares = useMemo(() => {
    const out: string[] = [];
    for (let r = 1; r <= 8; r++) for (const f of "abcdefgh") {
      const sq = f + r;
      if (!visible.has(sq)) out.push(sq);
    }
    return out;
  }, [visible]);

  function squareToOverlayStyle(sq: string): React.CSSProperties {
    const fileIdx = sq.charCodeAt(0) - 97; // 0..7
    const rankIdx = parseInt(sq[1], 10) - 1; // 0..7
    // Account for board orientation (viewerColor)
    const col = viewerColor === "w" ? fileIdx : 7 - fileIdx;
    const row = viewerColor === "w" ? 7 - rankIdx : rankIdx;
    return {
      position: "absolute",
      left: `${col * 12.5}%`,
      top: `${row * 12.5}%`,
      width: "12.5%",
      height: "12.5%",
      background: "#000",
      pointerEvents: "none",
    };
  }

  return (
    <Card className="p-3 relative">
      <div className="relative">
        <Chessboard options={{
          position: chessRef.current.fen(),
          onPieceDrop,
          boardOrientation: viewerColor === "w" ? "white" : "black",
          animationDurationInMs: 200,
          boardStyle: { borderRadius: 12 },
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: 12, overflow: "hidden" }}>
          {hiddenSquares.map((sq) => (
            <div key={sq} style={squareToOverlayStyle(sq)} />
          ))}
        </div>
      </div>
      {mode === "local" && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {viewerColor === "w" ? "White's view" : "Black's view"} — pass the device on each turn
        </p>
      )}
    </Card>
  );
}
