import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, Trophy, X } from "lucide-react";

export function MiniGameResultModal({
  open, won, stars, message, onReplay, onExit,
}: {
  open: boolean;
  won: boolean;
  stars: number;
  message: string;
  onReplay: () => void;
  onExit: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="relative w-full max-w-sm p-6 text-center space-y-4 border-primary/40 shadow-2xl">
        <button onClick={onExit} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <div className="text-5xl">{won ? "🏆" : "💀"}</div>
        <h2 className="text-2xl font-extrabold">{won ? "Victory!" : "Defeated"}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <Star key={i} className={`h-10 w-10 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onReplay} className="flex-1">Replay</Button>
          <Button onClick={onExit} className="flex-1"><Trophy className="h-4 w-4 mr-1" />Hub</Button>
        </div>
      </Card>
    </div>
  );
}
