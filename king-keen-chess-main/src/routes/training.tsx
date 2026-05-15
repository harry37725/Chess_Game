import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTrainingState } from "@/lib/training/state";
import { Hud } from "@/components/training/Hud";
import { WorldMap } from "@/components/training/WorldMap";
import { LevelRunner } from "@/components/training/LevelRunner";
import type { TrainingLevel } from "@/lib/training/levels";

export const Route = createFileRoute("/training")({
  component: TrainingPage,
  head: () => ({ meta: [{ title: "Train — Knight Chess" }] }),
});

function TrainingPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const { stats, levels, progress, loading, completeLevel, failLevel } = useTrainingState();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/auth" });
  }, [authLoading, user, nav]);

  const activeLevel = useMemo(() => levels.find((l) => l.id === activeId) ?? null, [activeId, levels]);
  const nextLevel = useMemo(() => {
    if (!activeLevel) return null;
    const sorted = levels;
    const idx = sorted.findIndex((l) => l.id === activeLevel.id);
    return sorted[idx + 1] ?? null;
  }, [activeLevel, levels]);

  if (!user || loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading training…</div>;
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--gradient-bg)" }}>
      <Hud stats={stats} />
      {!activeLevel ? (
        <WorldMap levels={levels} progress={progress} onPickLevel={(l) => setActiveId(l.id)} />
      ) : (
        <LevelRunner
          key={activeLevel.id}
          level={activeLevel}
          onExit={() => setActiveId(null)}
          onCompleteLevel={(stars) => completeLevel(activeLevel, stars)}
          onFailLevel={() => failLevel(activeLevel) as any}
          hasNext={!!nextLevel}
          onNext={() => nextLevel && setActiveId(nextLevel.id)}
        />
      )}
    </main>
  );
}

// Avoid unused import warnings if shaken
export type _Keep = TrainingLevel;
