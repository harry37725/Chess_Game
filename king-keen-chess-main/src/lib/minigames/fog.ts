import { Chess } from "chess.js";
import type { Difficulty } from "./types";

// Returns a Set of squares (e.g., "e4") that the given side can see.
export function computeVision(fen: string, side: "w" | "b", difficulty: Difficulty): Set<string> {
  const c = new Chess(fen);
  const board = c.board();
  const visible = new Set<string>();
  // 1) Own occupied squares
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.color === side) {
        const name = "abcdefgh"[f] + (8 - r);
        visible.add(name);
      }
    }
  }
  // 2) Squares attacked by own pieces. Use chess.js: temporarily put side to move, gather move targets.
  // Simpler: use chess.attackers via SQUARES? chess.js v1 has attacks; emulate with a fresh game where it's our turn.
  const tmp = new Chess(fen);
  // If it's not our turn, swap — chess.js exposes "isAttacked"
  const SQUARES = (() => {
    const out: string[] = [];
    for (let r = 1; r <= 8; r++) for (const f of "abcdefgh") out.push(f + r);
    return out;
  })();
  for (const sq of SQUARES) {
    try {
      // @ts-ignore — isAttacked is available
      if (tmp.isAttacked(sq as any, side)) visible.add(sq);
    } catch { /* ignore */ }
  }
  // Easy: extend by 1 square ring around any visible square
  if (difficulty === "easy") {
    const extra = new Set<string>();
    for (const sq of visible) {
      const f = sq.charCodeAt(0) - 97;
      const r = parseInt(sq[1], 10) - 1;
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) extra.add("abcdefgh"[nf] + (nr + 1));
      }
    }
    for (const s of extra) visible.add(s);
  }
  // Hard: hide own pieces not adjacent to a friendly piece
  if (difficulty === "hard") {
    const own = new Set<string>();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (sq && sq.color === side) own.add("abcdefgh"[f] + (8 - r));
    }
    for (const sq of [...own]) {
      const f = sq.charCodeAt(0) - 97;
      const r = parseInt(sq[1], 10) - 1;
      let adjacent = false;
      for (let df = -1; df <= 1 && !adjacent; df++) for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const nf = f + df, nr = r + dr;
        if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8 && own.has("abcdefgh"[nf] + (nr + 1))) { adjacent = true; break; }
      }
      if (!adjacent) visible.delete(sq);
    }
  }
  return visible;
}
