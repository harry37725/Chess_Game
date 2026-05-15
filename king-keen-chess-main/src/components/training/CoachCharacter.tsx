// Coach knight that lives in its own row beneath the board (no longer overlaps pieces).
type State = "idle" | "correct" | "wrong" | "celebrate";

export function CoachCharacter({ state = "idle", message }: { state?: State; message?: string }) {
  const anim =
    state === "correct" ? "animate-bounce" :
    state === "wrong"   ? "animate-[shake_0.4s_ease-in-out]" :
    state === "celebrate" ? "animate-bounce" :
    "animate-[float_3s_ease-in-out_infinite]";
  const emoji = state === "wrong" ? "😟" : state === "celebrate" ? "🎉" : state === "correct" ? "👍" : "🐴";
  return (
    <div className="mt-3 flex items-center gap-2 select-none">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card border-2 border-primary text-xl shadow ${anim}`}>
        {emoji}
      </div>
      {message && (
        <div className="relative rounded-2xl bg-card border border-border px-3 py-1.5 text-xs font-medium shadow-sm">
          {message}
        </div>
      )}
    </div>
  );
}
