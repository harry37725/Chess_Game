import { useEffect, useRef } from "react";
import { Lock, Star, Crown } from "lucide-react";
import { WORLDS, isLevelUnlocked, type TrainingLevel } from "@/lib/training/levels";
import type { LevelProgress } from "@/lib/training/state";

export function WorldMap({
  levels, progress, onPickLevel,
}: {
  levels: TrainingLevel[];
  progress: Record<string, LevelProgress>;
  onPickLevel: (l: TrainingLevel) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const completed = new Set(Object.values(progress).filter((p) => p.completed_at).map((p) => p.level_id));

  // Restore scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const y = parseInt(sessionStorage.getItem("trainingScroll") ?? "0", 10);
    if (y) el.scrollTop = y;
    const handler = () => sessionStorage.setItem("trainingScroll", String(el.scrollTop));
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div ref={scrollRef} className="overflow-y-auto h-[calc(100vh-3.25rem)]">
      <div className="mx-auto max-w-2xl pb-16">
        {WORLDS.map((world) => {
          const wLevels = levels.filter((l) => l.world === world.num);
          if (wLevels.length === 0) return null;
          return (
            <section key={world.num} className={`relative bg-gradient-to-b ${world.bgClass} px-4 py-8`}>
              <WorldBanner world={world} />
              <div className="relative mt-6">
                {/* winding SVG path */}
                <svg viewBox={`0 0 100 ${wLevels.length * 80}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <path
                    d={pathFor(wLevels.length)}
                    fill="none" stroke={world.accent} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6"
                  />
                </svg>
                <div className="relative space-y-6">
                  {wLevels.map((lvl, i) => {
                    const p = progress[lvl.id];
                    const unlocked = isLevelUnlocked(lvl, levels, completed);
                    const isCompleted = !!p?.completed_at;
                    const stars = p?.stars ?? 0;
                    const offset = nodeOffset(i);
                    return (
                      <div key={lvl.id} className="relative h-16 flex items-center" style={{ paddingLeft: `${offset}%` }}>
                        <button
                          onClick={() => unlocked && onPickLevel(lvl)}
                          disabled={!unlocked}
                          className={`relative h-16 w-16 rounded-full border-4 grid place-items-center font-bold text-lg transition-all
                            ${isCompleted
                              ? "bg-yellow-400 border-yellow-200 text-yellow-900 shadow-[0_0_24px_rgba(250,204,21,0.4)]"
                              : unlocked
                                ? "bg-card border-primary text-foreground shadow-[0_0_22px_rgba(168,85,247,0.4)] animate-pulse"
                                : "bg-muted/40 border-muted text-muted-foreground/60 cursor-not-allowed"}
                            ${lvl.type === "boss" ? "ring-4 ring-red-500/60" : ""}
                          `}
                          title={lvl.title}
                        >
                          {!unlocked ? <Lock className="h-5 w-5" /> :
                            lvl.type === "boss" ? <Crown className="h-7 w-7" /> :
                            lvl.level_number}
                          {isCompleted && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-0.5">
                              {[0,1,2].map((s) => (
                                <Star key={s} className={`h-3 w-3 ${s < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
                              ))}
                            </div>
                          )}
                        </button>
                        <div className="ml-3 text-white/90">
                          <div className="text-sm font-semibold leading-tight">{lvl.title}</div>
                          <div className="text-xs opacity-80">{lvl.goal}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function nodeOffset(i: number) {
  // sine-like wind 5..65%
  const positions = [10, 30, 55, 65, 50, 30, 15, 25];
  return positions[i % positions.length];
}

function pathFor(n: number) {
  // generate a winding S path matching nodeOffset sequence
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = nodeOffset(i) + 8;
    const y = i * 80 + 40;
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return parts.join(" ");
}

function WorldBanner({ world }: { world: typeof WORLDS[number] }) {
  return (
    <div className="text-center text-white">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur border border-white/20 text-xs font-semibold uppercase tracking-wider">
        World {world.num}
      </div>
      <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold drop-shadow">
        <span className="mr-1">{world.emoji}</span>{world.title}
      </h2>
      <p className="text-xs opacity-80">{world.blurb}</p>
    </div>
  );
}
