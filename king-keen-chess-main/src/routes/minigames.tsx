import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trophy, Star, Globe } from "lucide-react";
import { MINIGAMES } from "@/lib/minigames/registry";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/minigames")({
  component: MinigamesRoute,
  head: () => ({ meta: [{ title: "Mini Games — Knight Chess" }, { name: "description", content: "Five chess mini-games: Knight's Tour, King of the Hill, Pawn Wars, Fog of War, Piece Survival." }] }),
});

function MinigamesRoute() {
  const { pathname } = useLocation();
  return pathname === "/minigames" ? <MinigamesHub /> : <Outlet />;
}

type PB = { game_type: string; best_stars: number; best_time_seconds: number | null; total_plays: number; wins: number };

function MinigamesHub() {
  const { user } = useAuth();
  const [pbs, setPbs] = useState<Record<string, PB>>({});
  const [leaderboard, setLeaderboard] = useState<Array<{ user_id: string; username: string; total: number }>>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("minigame_personal_bests").select("*").eq("user_id", user.id).then(({ data }) => {
      const m: Record<string, PB> = {};
      (data ?? []).forEach((p: any) => { m[p.game_type] = p; });
      setPbs(m);
    });
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("minigame_personal_bests").select("user_id,best_stars");
      const totals = new Map<string, number>();
      (data ?? []).forEach((r: any) => totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + (r.best_stars ?? 0)));
      const ids = [...totals.keys()].slice(0, 50);
      if (!ids.length) return;
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.username ?? "Player"]));
      const ranked = [...totals.entries()].map(([id, t]) => ({ user_id: id, username: map.get(id) ?? "Player", total: t }))
        .sort((a, b) => b.total - a.total).slice(0, 10);
      setLeaderboard(ranked);
    })();
  }, []);

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild><Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />Home</Link></Button>
          <h1 className="text-2xl font-bold">Mini Games</h1>
          <span className="w-16" />
        </header>

        <Tabs defaultValue="games">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="leaderboard"><Trophy className="h-3 w-3 mr-1" />Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="grid sm:grid-cols-2 gap-4 mt-4">
            {MINIGAMES.map((g) => {
              const pb = pbs[g.id];
              return (
                <Card key={g.id} className="p-5 space-y-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{g.emoji}</span>
                    <div>
                      <h3 className="text-lg font-bold leading-tight">{g.title}</h3>
                      <p className="text-xs text-muted-foreground">{g.blurb}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {pb ? <>Best <Star className="inline h-3 w-3 fill-yellow-400 text-yellow-400 mx-0.5" />{pb.best_stars} · {pb.total_plays} plays</> : "Not played yet"}
                    </span>
                    <Button asChild size="sm">
                      <Link to="/minigames/$game" params={{ game: g.id }}>Play</Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                <Globe className="h-3 w-3" /> Public leaderboard — total stars across all five games
              </p>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No scores yet. Be the first!</p>
              ) : (
                <ol className="space-y-1">
                  {leaderboard.map((p, i) => (
                    <li key={p.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span><b className="mr-2 text-muted-foreground">#{i + 1}</b>{p.username}</span>
                      <span className="font-semibold flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{p.total}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
