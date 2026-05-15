import { Chess, type Move } from "chess.js";

// King-only Manhattan-pathfinder toward the four center squares.
const CENTER = ["d4", "e4", "d5", "e5"];
const dist = (a: string, b: string) => {
  const ax = a.charCodeAt(0) - 97, ay = parseInt(a[1], 10) - 1;
  const bx = b.charCodeAt(0) - 97, by = parseInt(b[1], 10) - 1;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
};

export function kingAi(fen: string): Move | null {
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;
  let best = moves[0]; let bestD = Infinity;
  for (const m of moves) {
    const d = Math.min(...CENTER.map((sq) => dist(m.to as string, sq)));
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

// Pawn-only AI: advance, capture, block.
export function pawnAi(fen: string, level: "easy" | "medium" | "hard" = "medium"): Move | null {
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;
  if (level === "easy") return moves[Math.floor(Math.random() * moves.length)];
  const turn = c.turn();
  const score = (m: Move) => {
    let s = 0;
    if (m.captured) s += 10;
    // Advance: distance to promotion rank
    const ry = parseInt((m.to as string)[1], 10);
    s += turn === "w" ? ry : 9 - ry;
    if (m.promotion) s += 50;
    return s;
  };
  const sorted = [...moves].sort((a, b) => score(b) - score(a));
  if (level === "hard" && sorted.length > 1 && Math.random() < 0.3) return sorted[1];
  return sorted[0];
}

// Hunter AI: capture highest-value reachable piece, else move to attack most.
const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function hunterAi(fen: string): Move | null {
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true }) as Move[];
  if (!moves.length) return null;
  // Captures first by value
  const captures = moves.filter((m) => m.captured).sort((a, b) => (VAL[b.captured!] ?? 0) - (VAL[a.captured!] ?? 0));
  if (captures.length) return captures[0];
  // Otherwise move to maximise attacked-piece count
  let best = moves[0]; let bestCount = -1;
  for (const m of moves) {
    const t = new Chess(c.fen());
    t.move(m);
    // Count enemy pieces attacked
    const enemyColor = t.turn();
    let count = 0;
    const board = t.board();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.color === enemyColor) {
        const name = "abcdefgh"[f] + (8 - r);
        // @ts-ignore
        if (t.isAttacked(name as any, enemyColor === "w" ? "b" : "w")) count++;
      }
    }
    if (count > bestCount) { bestCount = count; best = m; }
  }
  return best;
}
