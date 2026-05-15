import { useEffect, useState } from "react";
import { Star, Coins, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { tsfx } from "@/lib/training/sounds";

export function LevelCompleteModal({
  open, stars, coins, streakBonus, onNext, onReplay, onMap, hasNext,
}: {
  open: boolean;
  stars: number;
  coins: number;
  streakBonus?: boolean;
  onNext: () => void;
  onReplay: () => void;
  onMap: () => void;
  hasNext: boolean;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!open) { setShown(0); return; }
    tsfx.levelComplete();
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(i);
      tsfx.star();
      if (i >= 3) clearInterval(id);
    }, 350);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in p-4">
      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-[-10%] block w-2 h-3 rounded-sm"
            style={{
              left: `${(i * 4.2) % 100}%`,
              background: ["#fde68a", "#fca5a5", "#a7f3d0", "#bfdbfe", "#d8b4fe"][i % 5],
              animation: `confetti ${2 + (i % 5) * 0.3}s linear ${i * 0.06}s forwards`,
              transform: `rotate(${i * 27}deg)`,
            }}
          />
        ))}
      </div>
      <Card className="relative w-full max-w-sm p-6 text-center space-y-4 border-primary/40 shadow-2xl">
        <button onClick={onMap} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h2 className="text-2xl font-extrabold tracking-tight">Level Complete!</h2>
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <Star
              key={i}
              className={`h-12 w-12 transition-all duration-300 ${i < shown && i < stars ? "fill-yellow-400 text-yellow-400 scale-110 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]" : "text-muted-foreground/30"}`}
              style={{ transform: i < shown ? "scale(1.1)" : "scale(0.6)" }}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-amber-400 text-lg font-bold">
          <Coins className="h-5 w-5" /> +{coins}
        </div>
        {streakBonus && (
          <div className="text-xs font-semibold text-orange-400">🔥 Streak bonus active!</div>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onReplay} className="flex-1">Replay</Button>
          <Button variant="ghost" onClick={onMap} className="flex-1">Map</Button>
          {hasNext && <Button onClick={onNext} className="flex-1">Next →</Button>}
        </div>
      </Card>
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes board-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-1deg); }
          40% { transform: translateX(6px) rotate(1deg); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
