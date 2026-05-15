import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, User } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Game History — Knight Chess" }] }),
});

type Row = {
  id: string;
  result: string;
  opponent: string;
  mode: string;
  played_at: string;
};

function HistoryPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("game_history")
      .select("id,result,opponent,mode,played_at")
      .order("played_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user]);

  if (!user) return null;

  const wins = rows.filter((r) => r.result === "win").length;
  const losses = rows.filter((r) => r.result === "loss").length;
  const draws = rows.filter((r) => r.result === "draw").length;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Game History</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/profile"><User className="h-4 w-4 mr-1" />Profile</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to="/"><Home className="h-4 w-4 mr-1" />Home</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center"><div className="text-2xl font-bold text-primary">{wins}</div><div className="text-xs text-muted-foreground">Wins</div></Card>
          <Card className="p-4 text-center"><div className="text-2xl font-bold">{draws}</div><div className="text-xs text-muted-foreground">Draws</div></Card>
          <Card className="p-4 text-center"><div className="text-2xl font-bold text-destructive">{losses}</div><div className="text-xs text-muted-foreground">Losses</div></Card>
        </div>

        <Card className="divide-y">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No games yet. Go play one!</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">vs {r.opponent}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.played_at).toLocaleString()} · {r.mode}</div>
                </div>
                <Badge variant={r.result === "win" ? "default" : r.result === "loss" ? "destructive" : "secondary"}>
                  {r.result.toUpperCase()}
                </Badge>
              </div>
            ))
          )}
        </Card>
      </div>
    </main>
  );
}
