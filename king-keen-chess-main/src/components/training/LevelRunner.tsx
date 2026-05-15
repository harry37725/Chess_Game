import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, RotateCcw, Heart, Target, Clock, Crown } from "lucide-react";
import { LevelCompleteModal } from "./LevelCompleteModal";
import { GuidanceOverlay, type Arrow, type Highlight } from "./GuidanceOverlay";
import type { TrainingLevel } from "@/lib/training/levels";
import { coinsForStars } from "@/lib/training/levels";
import { tsfx } from "@/lib/training/sounds";
import { sfx } from "@/lib/sounds";
import { findBestMove } from "@/lib/chess-ai";
import { toast } from "sonner";

type FinishCb = (stars: number) => Promise<{ coinsEarned: number; isFirstClear: boolean } | undefined> | void;

// BUG FIX: chess.js throws if the FEN is missing a king or is otherwise invalid.
// Wrap construction in a try/catch and fall back to the starting position so the
// board always renders rather than crashing the whole training page.
function safeParseFen(fen: string): Chess {
  try {
    const c = new Chess(fen);
    return c;
  } catch {
    console.error("[LevelRunner] Invalid FEN:", fen, "— falling back to start position");
    return new Chess();
  }
}

export function LevelRunner({
  level, onExit, onCompleteLevel, onFailLevel, hasNext, onNext,
}: {
  level: TrainingLevel;
  onExit: () => void;
  onCompleteLevel: (stars: number) => Promise<{ coinsEarned: number; starsGained: number; isFirstClear: boolean; totalStars: number } | undefined> | void;
  onFailLevel: () => Promise<void> | void;
  hasNext: boolean;
  onNext: () => void;
}) {
  switch (level.type) {
    case "tutorial":   return <BoardLevel level={level} mode="tutorial"   onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "find-move":  return <BoardLevel level={level} mode="find-move"  onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "checkmate":  return <BoardLevel level={level} mode="checkmate"  onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "opening":    return <OpeningLevel level={level} onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "survive":    return <SurviveLevel level={level} onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "clock":      return <ClockLevel   level={level} onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
    case "boss":       return <BossLevel    level={level} onExit={onExit} onComplete={onCompleteLevel} onFail={onFailLevel} hasNext={hasNext} onNext={onNext} />;
  }
}

// Helpers
function uciToFromTo(uci: string) {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promo: uci.slice(4) || undefined };
}

function LevelHeader({ level, onExit, extra }: { level: TrainingLevel; onExit: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <Button variant="ghost" size="sm" onClick={onExit}><ArrowLeft className="h-4 w-4 mr-1" />Map</Button>
      <div className="text-center flex-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">W{level.world} · L{level.level_number}</div>
        <div className="text-base font-bold leading-tight">{level.title}</div>
      </div>
      <div className="w-[68px] flex justify-end">{extra}</div>
    </div>
  );
}

function GoalBar({ level, dotsTotal, dotsUsed }: { level: TrainingLevel; dotsTotal?: number; dotsUsed?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-xl bg-muted/40 border border-border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Target className="h-4 w-4 text-primary" /> {level.goal}
      </div>
      {dotsTotal != null && (
        <div className="flex gap-1">
          {Array.from({ length: dotsTotal }).map((_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < (dotsUsed ?? 0) ? "bg-muted-foreground/30" : "bg-primary"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// Generic single/multi-move board level (tutorial / find-move / checkmate)
function BoardLevel({
  level, mode, onExit, onComplete, onFail, hasNext, onNext,
}: {
  level: TrainingLevel;
  mode: "tutorial" | "find-move" | "checkmate";
  onExit: () => void;
  onComplete: FinishCb;
  onFail: () => Promise<void> | void;
  hasNext: boolean;
  onNext: () => void;
}) {
  const solutionMoves = useMemo(() => (level.solution_uci ?? "").split(";").filter(Boolean), [level]);
  const totalMoves = level.move_limit ?? solutionMoves.length ?? 1;

  // BUG FIX: use safeParseFen so an invalid FEN never crashes the component
  const [chess] = useState(() => safeParseFen(level.fen));
  const [, force] = useState(0);
  const [movesUsed, setMovesUsed] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [coachMsg, setCoachMsg] = useState<string | null>(level.coach_hint ?? null);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState<{ stars: number; coins: number } | null>(null);

  // BUG FIX: orientation is derived from the FEN's side-to-move, not from chess.turn()
  // after moves (which could flip unexpectedly). We lock it to the initial turn.
  const initialTurn = useMemo(() => {
    try { return new Chess(level.fen).turn(); } catch { return "w"; }
  }, [level.fen]);
  const orientation: "white" | "black" = initialTurn === "w" ? "white" : "black";

  const turn = chess.turn();
  const expectedStep = solutionMoves[movesUsed];
  const expected = expectedStep ? uciToFromTo(expectedStep) : null;

  // Difficulty-scaled guidance: easier levels show explicit piece + destination,
  // harder levels gradually strip the visual aids. Text hint always remains.
  // 1 = full (highlight from + to + arrow), 2 = from + arrow,
  // 3 = subtle from highlight only, 4+ = no overlay.
  const guidance = useMemo<{ arrows: Arrow[]; highlights: Highlight[] }>(() => {
    if (done || !expected) return { arrows: [], highlights: [] };
    const d = level.difficulty ?? 1;
    if (d >= 4) return { arrows: [], highlights: [] };
    const highlights: Highlight[] = [{ square: expected.from, color: "#22c55e" }];
    const arrows: Arrow[] = [];
    if (d <= 2) arrows.push({ from: expected.from, to: expected.to, color: "#22c55e" });
    if (d <= 1) highlights.push({ square: expected.to, color: "#3b82f6" });
    return { arrows, highlights };
  }, [expected, level.difficulty, done]);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare || done) return false;
    const moveUci = `${sourceSquare}${targetSquare}`;
    const target = expected;
    const isCorrect = target ? (moveUci.slice(0, 4) === `${target.from}${target.to}`) : false;

    if (!isCorrect) {
      // Try the move on a temp board to see if it's even legal — illegal stays put
      const tmp = new Chess(chess.fen());
      const legal = tmp.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!legal) return false;
      // Wrong move
      sfx.move();
      tsfx.wrong();
      setMistakes((m) => m + 1);
      setShake(true); setTimeout(() => setShake(false), 400);
      setCoachMsg("Try again!");
      if (mode === "tutorial") {
        return false; // auto-undo: don't apply
      }
      // find-move/checkmate: 3 wrong = fail
      if (mistakes + 1 >= 3) {
        toast.error("Out of attempts");
        Promise.resolve(onFail()).then(onExit);
      }
      return false;
    }

    // Correct move
    chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    sfx.move();
    setCoachMsg("Nice!");
    setMovesUsed((n) => n + 1);
    force((x) => x + 1);

    const finishedAll = movesUsed + 1 >= solutionMoves.length;
    if (finishedAll) {
      let stars = 3;
      if (mistakes >= 1) stars = 2;
      if (mistakes >= 3) stars = 1;
      const coins = coinsForStars(stars, level.type);
      setCoachMsg("You did it!");
      setDone({ stars, coins });
      Promise.resolve(onComplete(stars));
    }
    return true;
  }, [chess, expected, mistakes, done, level, mode, movesUsed, solutionMoves.length, onComplete, onFail, onExit]);

  const replay = () => {
    const fresh = safeParseFen(level.fen);
    (chess as any).load(fresh.fen());
    setMovesUsed(0); setMistakes(0); setDone(null);
    setCoachMsg(level.coach_hint ?? null);
    force((x) => x + 1);
  };

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      <LevelHeader level={level} onExit={onExit} />
      <GoalBar level={level} dotsTotal={mode === "tutorial" ? totalMoves : undefined} dotsUsed={mode === "tutorial" ? movesUsed : undefined} />
      <div className={`relative rounded-2xl p-3 bg-card border border-border ${shake ? "animate-[board-shake_0.4s]" : ""}`} style={{ boxShadow: "var(--shadow-board)" }}>
        <Chessboard
          options={{
            position: chess.fen(),
            onPieceDrop,
            boardOrientation: orientation,
            boardStyle: { borderRadius: "12px" },
            darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" },
            lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" },
            animationDurationInMs: 200,
          }}
        />
        <GuidanceOverlay arrows={guidance.arrows} highlights={guidance.highlights} orientation={orientation} />
      </div>
      {coachMsg && (
        <div className="mt-2 text-center text-xs text-muted-foreground">{coachMsg}</div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{turn === "w" ? "White" : "Black"} to move</span>
        <Button size="sm" variant="ghost" onClick={replay}><RotateCcw className="h-3 w-3 mr-1" />Restart</Button>
      </div>
      <LevelCompleteModal
        open={!!done}
        stars={done?.stars ?? 0}
        coins={done?.coins ?? 0}
        onNext={() => { setDone(null); onNext(); }}
        onReplay={() => { setDone(null); replay(); }}
        onMap={onExit}
        hasNext={hasNext}
      />
    </div>
  );
}

// Opening trainer
function OpeningLevel({ level, onExit, onComplete, onFail, hasNext, onNext }: any) {
  const moves = useMemo(() => (level.solution_uci ?? "").split(";").filter(Boolean), [level]);
  const [chess] = useState(() => safeParseFen(level.fen));
  const [, force] = useState(0);
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState<{ stars: number; coins: number } | null>(null);
  const expected = moves[step];

  const onPieceDrop = ({ sourceSquare, targetSquare }: any) => {
    if (!targetSquare || done) return false;
    const uci = `${sourceSquare}${targetSquare}`;
    if (expected && uci === expected.slice(0, 4)) {
      chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      sfx.move();
      const nextStep = step + 1;
      setStep(nextStep);
      setTimeout(() => {
        const best = findBestMove(chess.fen(), 2);
        if (best) { chess.move(best); sfx.move(); }
        force((x) => x + 1);
        if (nextStep >= moves.length) {
          const stars = mistakes === 0 ? 3 : mistakes <= 1 ? 2 : 1;
          setDone({ stars, coins: coinsForStars(stars, level.type) });
          onComplete(stars);
        }
      }, 300);
      return true;
    }
    const tmp = new Chess(chess.fen());
    if (!tmp.move({ from: sourceSquare, to: targetSquare, promotion: "q" })) return false;
    setMistakes((m) => m + 1);
    tsfx.wrong();
    toast.error("Not the book move — try again");
    if (mistakes + 1 >= 3) { Promise.resolve(onFail()).then(onExit); }
    return false;
  };

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      <LevelHeader level={level} onExit={onExit} />
      <GoalBar level={level} />
      <div className="relative rounded-2xl p-3 bg-card border border-border" style={{ boxShadow: "var(--shadow-board)" }}>
        <Chessboard options={{ position: chess.fen(), onPieceDrop, animationDurationInMs: 200, boardStyle: { borderRadius: 12 }, darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" }, lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" } }} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground text-center">Hint: {level.coach_hint}</div>
      <LevelCompleteModal open={!!done} stars={done?.stars ?? 0} coins={done?.coins ?? 0} onNext={() => { setDone(null); onNext(); }} onReplay={onExit} onMap={onExit} hasNext={hasNext} />
    </div>
  );
}

// Survive N moves vs AI
function SurviveLevel({ level, onExit, onComplete, onFail, hasNext, onNext }: any) {
  const N = level.move_limit ?? 5;
  const [chess] = useState(() => safeParseFen(level.fen));
  const [, force] = useState(0);
  const [moves, setMoves] = useState(0);
  const [health, setHealth] = useState(100);
  const [done, setDone] = useState<{ stars: number; coins: number } | null>(null);

  const onPieceDrop = ({ sourceSquare, targetSquare }: any) => {
    if (!targetSquare || done) return false;
    const m = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!m) return false;
    sfx.move();
    setTimeout(() => {
      const best = findBestMove(chess.fen(), 2);
      if (best) { chess.move(best); sfx.move(); }
      force((x) => x + 1);
      const newMoves = moves + 1;
      setMoves(newMoves);
      const lostPiece = chess.history({ verbose: true }).slice(-1)[0];
      if (lostPiece?.captured && "nbrq".includes(lostPiece.captured)) {
        setHealth((h) => Math.max(0, h - 30));
      }
      if (chess.isCheckmate()) { setHealth(0); }
      if (newMoves >= N || health <= 0) {
        const finalH = health <= 0 ? 0 : health;
        if (finalH <= 0) { Promise.resolve(onFail()).then(onExit); return; }
        const stars = finalH >= 90 ? 3 : finalH >= 60 ? 2 : 1;
        setDone({ stars, coins: coinsForStars(stars, level.type) });
        onComplete(stars);
      }
    }, 300);
    return true;
  };

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      <LevelHeader level={level} onExit={onExit} extra={<div className="flex items-center gap-1 text-sm"><Heart className="h-4 w-4 text-red-500" />{health}</div>} />
      <GoalBar level={level} />
      <div className="mb-2 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 transition-all" style={{ width: `${health}%` }} />
      </div>
      <div className="text-xs text-center text-muted-foreground mb-2">Move {moves}/{N}</div>
      <div className="relative rounded-2xl p-3 bg-card border border-border" style={{ boxShadow: "var(--shadow-board)" }}>
        <Chessboard options={{ position: chess.fen(), onPieceDrop, animationDurationInMs: 200, boardStyle: { borderRadius: 12 }, darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" }, lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" } }} />
      </div>
      <LevelCompleteModal open={!!done} stars={done?.stars ?? 0} coins={done?.coins ?? 0} onNext={() => { setDone(null); onNext(); }} onReplay={onExit} onMap={onExit} hasNext={hasNext} />
    </div>
  );
}

// Beat the clock
function ClockLevel({ level, onExit, onComplete, onFail, hasNext, onNext }: any) {
  const [chess] = useState(() => safeParseFen(level.fen));
  const [, force] = useState(0);
  const [t, setT] = useState(60);
  const [done, setDone] = useState<{ stars: number; coins: number } | null>(null);
  const expected = (level.solution_uci ?? "").split(";")[0];

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setT((x) => x - 1), 1000);
    return () => clearInterval(id);
  }, [done]);
  useEffect(() => {
    if (t <= 0 && !done) { Promise.resolve(onFail()).then(onExit); }
  }, [t, done, onFail, onExit]);

  const onPieceDrop = ({ sourceSquare, targetSquare }: any) => {
    if (!targetSquare || done) return false;
    const uci = `${sourceSquare}${targetSquare}`;
    if (expected && uci === expected.slice(0, 4)) {
      chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      force((x) => x + 1); sfx.move();
      const stars = t >= 40 ? 3 : t >= 20 ? 2 : 1;
      setDone({ stars, coins: coinsForStars(stars, level.type) });
      onComplete(stars);
      return true;
    }
    const tmp = new Chess(chess.fen());
    if (!tmp.move({ from: sourceSquare, to: targetSquare, promotion: "q" })) return false;
    tsfx.wrong();
    return false;
  };

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      <LevelHeader level={level} onExit={onExit} extra={<div className="flex items-center gap-1 text-sm tabular-nums"><Clock className="h-4 w-4" />{t}s</div>} />
      <GoalBar level={level} />
      <div className="mb-2 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(t / 60) * 100}%` }} />
      </div>
      <div className="relative rounded-2xl p-3 bg-card border border-border" style={{ boxShadow: "var(--shadow-board)" }}>
        <Chessboard options={{ position: chess.fen(), onPieceDrop, animationDurationInMs: 200, boardStyle: { borderRadius: 12 }, darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" }, lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" } }} />
      </div>
      <LevelCompleteModal open={!!done} stars={done?.stars ?? 0} coins={done?.coins ?? 0} onNext={() => { setDone(null); onNext(); }} onReplay={onExit} onMap={onExit} hasNext={hasNext} />
    </div>
  );
}

// Boss — full game vs AI
function BossLevel({ level, onExit, onComplete, onFail, hasNext, onNext }: any) {
  const [chess] = useState(() => safeParseFen(level.fen));
  const [, force] = useState(0);
  const [done, setDone] = useState<{ stars: number; coins: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const myColor: "w" | "b" = "w";
  const depth = Math.min(4, 1 + level.difficulty);

  useEffect(() => {
    if (chess.isGameOver()) {
      const result = chess.isCheckmate() ? (chess.turn() === myColor ? "loss" : "win") : "draw";
      if (result === "win") {
        tsfx.bossDefeated();
        const stars = 3;
        setDone({ stars, coins: coinsForStars(stars, level.type) });
        onComplete(stars);
      } else if (result === "loss") {
        toast.error("Defeated! Try again.");
        Promise.resolve(onFail()).then(onExit);
      }
    }
  });

  const onPieceDrop = ({ sourceSquare, targetSquare }: any) => {
    if (!targetSquare || done || thinking || chess.turn() !== myColor) return false;
    const m = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    if (!m) return false;
    sfx.move(); force((x) => x + 1);
    if (chess.isGameOver()) return true;
    setThinking(true);
    setTimeout(() => {
      const best = findBestMove(chess.fen(), depth);
      if (best) { chess.move(best); sfx.move(); }
      force((x) => x + 1);
      setThinking(false);
    }, 250);
    return true;
  };

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      <LevelHeader level={level} onExit={onExit} extra={<div className="flex items-center gap-1 text-xs text-red-400"><Crown className="h-4 w-4" />BOSS</div>} />
      <GoalBar level={level} />
      <div className="relative rounded-2xl p-3 bg-card border border-border" style={{ boxShadow: "var(--shadow-board)" }}>
        <Chessboard options={{ position: chess.fen(), onPieceDrop, boardOrientation: "white", animationDurationInMs: 200, boardStyle: { borderRadius: 12 }, darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" }, lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" } }} />
        {thinking && <div className="absolute top-5 right-5 text-xs px-2 py-1 rounded-full bg-background/80">Thinking…</div>}
      </div>
      <LevelCompleteModal open={!!done} stars={done?.stars ?? 0} coins={done?.coins ?? 0} onNext={() => { setDone(null); onNext(); }} onReplay={onExit} onMap={onExit} hasNext={hasNext} />
    </div>
  );
}
