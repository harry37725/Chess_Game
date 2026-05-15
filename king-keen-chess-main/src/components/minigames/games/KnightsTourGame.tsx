import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, PlayMode, RoomRow } from "@/lib/minigames/types";

type Sq = { f: number; r: number };
const sqEq = (a: Sq, b: Sq) => a.f === b.f && a.r === b.r;
const KNIGHT_OFFS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];

function knightMoves(s: Sq, visited: Sq[]): Sq[] {
  const out: Sq[] = [];
  for (const [df, dr] of KNIGHT_OFFS) {
    const f = s.f + df, r = s.r + dr;
    if (f < 0 || f > 7 || r < 0 || r > 7) continue;
    const t = { f, r };
    if (visited.some((v) => sqEq(v, t))) continue;
    out.push(t);
  }
  return out;
}

const DIFF_UNDOS: Record<Difficulty, number> = { easy: 99, medium: 3, hard: 0 };

export function KnightsTourGame({
  mode, difficulty, room, onFinish,
}: {
  mode: PlayMode;
  difficulty: Difficulty;
  room?: RoomRow;
  onFinish: (won: boolean, stars: number, timeSec?: number) => void;
}) {
  const [start, setStart] = useState<Sq | null>(null);
  const [visited, setVisited] = useState<Sq[]>([]);
  const [pos, setPos] = useState<Sq | null>(null);
  const [undos, setUndos] = useState(DIFF_UNDOS[difficulty]);
  const startedAt = useRef<number>(0);
  const [opponentCount, setOpponentCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Online race channel
  useEffect(() => {
    if (mode !== "online" || !room) return;
    const ch = supabase.channel(`mg:${room.room_code}`);
    channelRef.current = ch;
    ch.on("broadcast", { event: "mg" }, ({ payload }) => {
      if (payload?.type === "progress") setOpponentCount(payload.count);
      if (payload?.type === "finish") onFinish(visited.length > payload.count, starsFor(visited.length), Math.round((Date.now() - startedAt.current) / 1000));
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode, room]);

  // Broadcast progress
  useEffect(() => {
    if (mode === "online" && channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "mg", payload: { type: "progress", count: visited.length } });
    }
  }, [visited.length, mode]);

  const validNext = useMemo(() => (pos ? knightMoves(pos, visited) : []), [pos, visited]);

  function starsFor(count: number) {
    if (count >= 64) return 3;
    if (count >= 50) return 2;
    if (count >= 30) return 1;
    return 0;
  }

  function pick(sq: Sq) {
    if (!start) {
      setStart(sq); setPos(sq); setVisited([sq]);
      startedAt.current = Date.now();
      return;
    }
    if (!pos) return;
    if (validNext.some((v) => sqEq(v, sq))) {
      const next = [...visited, sq];
      setVisited(next); setPos(sq);
      if (next.length >= 64) {
        const t = Math.round((Date.now() - startedAt.current) / 1000);
        if (channelRef.current) channelRef.current.send({ type: "broadcast", event: "mg", payload: { type: "finish", count: 64 } });
        onFinish(true, 3, t);
      } else if (knightMoves(sq, next).length === 0) {
        // Stuck
        const stars = starsFor(next.length);
        if (channelRef.current) channelRef.current.send({ type: "broadcast", event: "mg", payload: { type: "finish", count: next.length } });
        onFinish(false, stars, Math.round((Date.now() - startedAt.current) / 1000));
      }
    }
  }

  function undo() {
    if (undos <= 0 || visited.length <= 1) return;
    const v = visited.slice(0, -1);
    setVisited(v); setPos(v[v.length - 1]); setUndos((u) => u - 1);
  }

  function reset() {
    setStart(null); setVisited([]); setPos(null); setUndos(DIFF_UNDOS[difficulty]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>Visited <b>{visited.length}</b> / 64</span>
        {mode === "online" && <span className="text-muted-foreground">Opponent: {opponentCount} / 64</span>}
        <span className="text-muted-foreground">Undos: {undos === 99 ? "∞" : undos}</span>
      </div>
      <Card className="p-2">
        <div className="grid grid-cols-8 gap-px aspect-square bg-border">
          {Array.from({ length: 64 }).map((_, i) => {
            const f = i % 8, r = 7 - Math.floor(i / 8);
            const sq = { f, r };
            const isVisited = visited.findIndex((v) => sqEq(v, sq));
            const isCurrent = pos && sqEq(pos, sq);
            const isValid = !!start && validNext.some((v) => sqEq(v, sq));
            const dark = (f + r) % 2 === 0;
            return (
              <button
                key={i}
                onClick={() => pick(sq)}
                className={`relative aspect-square text-xs font-bold transition-all ${
                  dark ? "bg-amber-900/70" : "bg-amber-100"
                } ${isVisited >= 0 ? "bg-primary/40" : ""} ${isValid ? "ring-2 ring-green-400 animate-pulse" : ""} ${
                  !start ? "ring-1 ring-primary/30" : ""
                }`}
              >
                {isCurrent && <span className="absolute inset-0 grid place-items-center text-2xl">♞</span>}
                {isVisited >= 0 && !isCurrent && (
                  <span className="absolute inset-0 grid place-items-center text-foreground/70">{isVisited + 1}</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={undo} disabled={undos <= 0 || visited.length <= 1}>Undo</Button>
        <Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3 w-3 mr-1" />Reset</Button>
      </div>
      {!start && <p className="text-xs text-muted-foreground text-center">Pick your starting square</p>}
    </div>
  );
}
