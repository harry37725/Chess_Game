import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useGlobalPresence } from "@/lib/presence";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Users, UserPlus, Swords, Check, X, Copy, ArrowLeft, Circle, Eye, UserMinus } from "lucide-react";

export const Route = createFileRoute("/friends")({ component: FriendsPage });

type Profile = {
  id: string;
  username: string | null;
  rating: number;
  friend_code: string | null;
  avatar_url: string | null;
};

type FriendRequest = {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  created_at: string;
  fromProfile?: Profile;
  toProfile?: Profile;
};

type GameInvite = {
  id: string;
  from_user: string;
  to_user: string;
  room_id: string;
  status: string;
  fromProfile?: Profile;
};

function FriendsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [activeGames, setActiveGames] = useState<Array<{ room_id: string; white_user: string; black_user: string; white_username: string | null; black_username: string | null }>>([]);
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setMe(prof as Profile);

    const { data: fs } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id);
    const friendIds = (fs ?? []).map((f: { friend_id: string }) => f.friend_id);
    if (friendIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);
      setFriends((profs ?? []) as Profile[]);
    } else {
      setFriends([]);
    }

    const { data: reqs } = await supabase
      .from("friend_requests")
      .select("*")
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .eq("status", "pending");
    if (reqs?.length) {
      const ids = Array.from(new Set(reqs.flatMap((r) => [r.from_user, r.to_user])));
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
      setRequests(
        reqs.map((r) => ({ ...r, fromProfile: map.get(r.from_user), toProfile: map.get(r.to_user) }))
      );
    } else {
      setRequests([]);
    }

    const { data: ginv } = await supabase
      .from("game_invites")
      .select("*")
      .eq("to_user", user.id)
      .eq("status", "pending");
    if (ginv?.length) {
      const ids = ginv.map((g) => g.from_user);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
      setInvites(ginv.map((g) => ({ ...g, fromProfile: map.get(g.from_user) })));
    } else {
      setInvites([]);
    }

    // Active games where any of my friends is playing
    if (friendIds.length) {
      const { data: ag } = await supabase
        .from("active_games")
        .select("*")
        .or(`white_user.in.(${friendIds.join(",")}),black_user.in.(${friendIds.join(",")})`)
      setActiveGames((ag ?? []) as any);
    } else {
      setActiveGames([]);
    }
  };

  useEffect(() => { refresh(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`friends-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, async (payload) => {
        // FIX: payload.new may be partial on UPDATE — re-fetch the full row by id before acting.
        const row = payload.new as Partial<GameInvite>;
        if (row.id) {
          const { data: fullRow } = await supabase
            .from("game_invites")
            .select("*")
            .eq("id", row.id)
            .maybeSingle();
          if (fullRow && fullRow.from_user === user.id && fullRow.status === "accepted") {
            // Challenger: their invite was accepted — navigate into the game as white.
            navigate({ to: "/", search: { room: fullRow.room_id, color: "w" } as any });
            return;
          }
        }
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "active_games" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, navigate]);

  const presenceSelf = useMemo(
    () =>
      me
        ? { user_id: me.id, username: me.username ?? "Anon", rating: me.rating, online_at: new Date().toISOString() }
        : null,
    [me]
  );
  const online = useGlobalPresence(presenceSelf);

  const sendRequestByCode = async () => {
    if (!user || !code.trim()) return;
    const { data: target } = await supabase
      .from("profiles")
      .select("*")
      .eq("friend_code", code.trim().toUpperCase())
      .maybeSingle();
    if (!target) return toast.error("No user with that friend code");
    if (target.id === user.id) return toast.error("That's your own code 🙂");
    await sendRequest(target.id);
    setCode("");
  };

  const sendRequestByUsername = async () => {
    if (!user || !search.trim()) return;
    const { data: target } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", search.trim())
      .maybeSingle();
    if (!target) return toast.error("No user found with that username");
    if (target.id === user.id) return toast.error("That's you 🙂");
    await sendRequest(target.id);
    setSearch("");
  };

  const sendRequest = async (toId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id)
      .eq("friend_id", toId)
      .maybeSingle();
    if (existing) return toast.error("You're already friends!");

    const { error } = await supabase
      .from("friend_requests")
      .insert({ from_user: user.id, to_user: toId, status: "pending" });
    if (error) {
      if (error.code === "23505") toast.error("Request already sent!");
      else toast.error(error.message);
    } else {
      toast.success("Friend request sent!");
    }
  };

  const acceptRequest = async (req: FriendRequest) => {
    if (!user) return;

    const { error: updateErr } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", req.id);
    if (updateErr) { toast.error(updateErr.message); return; }

    // Insert MY side
    const { error: myErr } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: req.from_user });
    if (myErr && myErr.code !== "23505") { toast.error(myErr.message); return; }

    // FIX: Insert THEIR side via security-definer RPC
    const { error: theirErr } = await (supabase as any).rpc("add_friendship_for_user", {
      p_user_id: req.from_user,
      p_friend_id: user.id,
    });

    if (theirErr) {
      console.warn("add_friendship_for_user RPC error:", theirErr.message);
      toast.success("Friend added! (Note: they may need to refresh to see you)");
    } else {
      toast.success("Friend added! ✓");
    }

    refresh();
  };

  const declineRequest = async (req: FriendRequest) => {
    await supabase.from("friend_requests").update({ status: "declined" }).eq("id", req.id);
    refresh();
  };

  // FIX: Remove friend — security-definer RPC removes both sides atomically
  const removeFriend = async (friend: Profile) => {
    if (!user) return;
    const { error } = await (supabase as any).rpc("remove_friendship", {
      p_user_id: user.id,
      p_friend_id: friend.id,
    });
    if (error) {
      // Fallback: delete only our side if RPC unavailable
      await supabase.from("friendships").delete()
        .eq("user_id", user.id).eq("friend_id", friend.id);
    }
    toast.success(`Removed ${friend.username ?? "friend"}`);
    refresh();
  };

  const challenge = async (friend: Profile) => {
    if (!user) return;
    const room_id = crypto.randomUUID();
    const { error } = await supabase.from("game_invites").insert({
      from_user: user.id,
      to_user: friend.id,
      room_id,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success(`Challenge sent to ${friend.username ?? "friend"}. Waiting…`);
  };

  const acceptInvite = async (inv: GameInvite) => {
    await supabase.from("game_invites").update({ status: "accepted" }).eq("id", inv.id);
    navigate({ to: "/", search: { room: inv.room_id, color: "b" } as any });
  };

  const declineInvite = async (inv: GameInvite) => {
    await supabase.from("game_invites").update({ status: "declined" }).eq("id", inv.id);
    refresh();
  };

  const copyCode = () => {
    if (me?.friend_code) {
      navigator.clipboard.writeText(me.friend_code);
      toast.success("Friend code copied!");
    }
  };

  const friendActiveGame = (friendId: string) =>
    activeGames.find((g) => g.white_user === friendId || g.black_user === friendId);

  if (loading || !me) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <main className="min-h-screen px-4 py-8" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />Friends
          </h1>
          <div className="w-16" />
        </div>

        <Card className="p-4 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground">Your friend code</p>
            <p className="font-mono text-xl font-bold tracking-wider">{me.friend_code ?? "—"}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={copyCode}>
            <Copy className="h-4 w-4 mr-1" />Copy
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4" />Add friend
          </h2>
          <div className="flex gap-2">
            <Input
              placeholder="Search by username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendRequestByUsername()}
            />
            <Button onClick={sendRequestByUsername}>Search</Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Enter friend code (e.g. A1B2C3)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && sendRequestByCode()}
              className="font-mono"
            />
            <Button onClick={sendRequestByCode} variant="secondary">Add by code</Button>
          </div>
        </Card>

        {invites.length > 0 && (
          <Card className="p-4 space-y-2 border-primary/40">
            <h2 className="font-semibold flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />Game challenges
            </h2>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <span className="text-sm"><b>{inv.fromProfile?.username ?? "Someone"}</b> challenged you</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => acceptInvite(inv)}>
                    <Check className="h-4 w-4 mr-1" />Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => declineInvite(inv)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {requests.length > 0 && (
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold">Friend requests</h2>
            {requests.map((r) => {
              const incoming = r.to_user === user!.id;
              const other = incoming ? r.fromProfile : r.toProfile;
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="text-sm">
                    {incoming ? "From" : "Sent to"} <b>{other?.username ?? "user"}</b>
                  </span>
                  {incoming ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptRequest(r)}>
                        <Check className="h-4 w-4 mr-1" />Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => declineRequest(r)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              );
            })}
          </Card>
        )}

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Your friends ({friends.length})</h2>
          <ScrollArea className="max-h-96">
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No friends yet. Add one with their username or code above.
              </p>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => {
                  const isOnline = !!online[f.id];
                  const activeGame = friendActiveGame(f.id);
                  return (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Circle className={`h-2 w-2 flex-shrink-0 ${isOnline ? "text-green-500 fill-green-500" : "text-muted-foreground"}`} />
                        <div>
                          <div className="font-medium text-sm">{f.username ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            Rating {f.rating} · {activeGame ? "🎮 In a game" : isOnline ? "Online" : "Offline"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* FIX: Spectate button shown inline when friend is in an active game */}
                        {activeGame ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate({ to: "/", search: { room: activeGame.room_id, spectate: true } as any })}
                          >
                            <Eye className="h-4 w-4 mr-1" />Spectate
                          </Button>
                        ) : (
                          <Button size="sm" disabled={!isOnline} onClick={() => challenge(f)}>
                            <Swords className="h-4 w-4 mr-1" />Challenge
                          </Button>
                        )}
                        {/* FIX: Remove friend button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove ${f.username ?? "this friend"}?`)) removeFriend(f);
                          }}
                          title="Remove friend"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>

        {activeGames.length > 0 && (
          <Card className="p-4 space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />Friends playing now
            </h2>
            {activeGames.map((g) => (
              <div key={g.room_id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <b>{g.white_username ?? "White"}</b>
                  <span className="text-muted-foreground"> vs </span>
                  <b>{g.black_username ?? "Black"}</b>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate({ to: "/", search: { room: g.room_id, spectate: true } as any })}
                >
                  <Eye className="h-4 w-4 mr-1" />Spectate
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </main>
  );
}
