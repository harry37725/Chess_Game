import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, History as HistoryIcon, Copy, Sparkles, Flame, Trophy, Coins, Star, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { useTrainingState } from "@/lib/training/state";
import { getWorld } from "@/lib/training/levels";
import { Link as RouterLink } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — Knight Chess" }] }),
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [rating, setRating] = useState(1200);
  const [busy, setBusy] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load profile: " + error.message);
          return;
        }
        if (data) {
          setProfileExists(true);
          setUsername(data.username ?? "");
          setAvatarUrl(data.avatar_url ?? "");
          setCountry(data.country ?? "");
          setBio(data.bio ?? "");
          setFriendCode(data.friend_code ?? null);
          setRating(data.rating ?? 1200);
        } else {
          // Profile row doesn't exist yet — create it now
          // (the trigger should have done this, but race conditions can happen)
          supabase
            .from("profiles")
            .insert({
              id: user.id,
              username: user.email?.split("@")[0] ?? "player",
            })
            .then(({ error: insertError }) => {
              if (!insertError) setProfileExists(true);
            });
        }
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);

    // Always UPDATE — never upsert (insert is blocked by RLS for existing users,
    // and the trigger handles row creation on signup).
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        country: country.trim() || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
        // friend_code and rating are NOT sent — never overwrite them here
      })
      .eq("id", user.id);

    setBusy(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Profile saved ✓");
  };

  const copyCode = () => {
    if (friendCode) {
      navigator.clipboard.writeText(friendCode);
      toast.success("Friend code copied!");
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your Profile</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history"><HistoryIcon className="h-4 w-4 mr-1" />History</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/"><Home className="h-4 w-4 mr-1" />Home</Link>
            </Button>
          </div>
        </div>

        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>
                {(username || user.email || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              <div className="font-medium text-foreground">{user.email}</div>
              <div>Member since {new Date(user.created_at).toLocaleDateString()}</div>
              <div className="mt-1">Rating: <span className="font-semibold text-foreground">{rating}</span></div>
            </div>
          </div>

          {/* Friend code — read only, shown prominently */}
          {friendCode && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Your friend code</p>
                <p className="font-mono text-lg font-bold tracking-widest">{friendCode}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={copyCode}>
                <Copy className="h-3 w-3 mr-1" />Copy
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Avatar URL</label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Country</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
          </div>

          <Button onClick={save} disabled={busy || !profileExists} className="w-full">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </Card>

        <TrainingSummary />
        <MinigamesSummary />
      </div>
    </main>
  );
}

function MinigamesSummary() {
  const { user } = useAuth();
  const [rating, setRating] = useState<number | null>(null);
  const [pbs, setPbs] = useState<Array<{ game_type: string; best_stars: number; total_plays: number; wins: number }>>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("minigame_rating").eq("id", user.id).maybeSingle().then(({ data }: any) => setRating(data?.minigame_rating ?? 1200));
    supabase.from("minigame_personal_bests").select("game_type,best_stars,total_plays,wins").eq("user_id", user.id).then(({ data }) => setPbs((data ?? []) as any));
  }, [user?.id]);
  if (!user) return null;
  const total = pbs.reduce((s, p) => s + (p.best_stars ?? 0), 0);
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><Gamepad2 className="h-5 w-5 text-primary" />Mini Games</h2>
        <Button asChild variant="secondary" size="sm"><RouterLink to="/minigames">Open Hub</RouterLink></Button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Rating" value={String(rating ?? "—")} />
        <Stat icon={<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />} label="Total Stars" value={String(total)} />
        <Stat icon={<Sparkles className="h-4 w-4 text-primary" />} label="Plays" value={String(pbs.reduce((s, p) => s + (p.total_plays ?? 0), 0))} />
      </div>
    </Card>
  );
}

function TrainingSummary() {
  const { stats, progress, loading } = useTrainingState();
  if (loading || !stats) return null;
  const world = getWorld(stats.current_world);
  const completed = Object.values(progress).filter((p) => p.completed_at).length;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Training</h2>
        <Button asChild variant="secondary" size="sm"><RouterLink to="/training">Open Map</RouterLink></Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="World" value={`${world.emoji} ${world.num}`} />
        <Stat icon={<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />} label="Stars" value={String(stats.total_stars)} />
        <Stat icon={<Coins className="h-4 w-4 text-amber-400" />} label="Coins" value={String(stats.coins)} />
        <Stat icon={<Flame className="h-4 w-4 text-orange-400" />} label="Streak" value={`${stats.streak}d`} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Levels cleared: <b className="text-foreground">{completed}</b></span>
      </div>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
