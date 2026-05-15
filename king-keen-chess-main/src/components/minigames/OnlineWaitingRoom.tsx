import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  createPrivateRoom, joinByCode, enterQuickMatch, cancelQueue,
  watchMyQueue, watchRoomGuest,
} from "@/lib/minigames/online";
import type { Difficulty, MiniGameId, RoomRow } from "@/lib/minigames/types";

export function OnlineWaitingRoom({
  gameType, difficulty, onReady, onCancel,
}: {
  gameType: MiniGameId;
  difficulty: Difficulty;
  onReady: (room: RoomRow, color: "w" | "b") => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"choose" | "host" | "join" | "quick">("choose");
  const [hostRoom, setHostRoom] = useState<RoomRow | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  // Cleanup queue on unmount
  useEffect(() => () => { if (user) cancelQueue(user.id, gameType); }, [user, gameType]);

  // Host: create room, watch for guest
  useEffect(() => {
    if (tab !== "host" || !user || hostRoom) return;
    let unsub: (() => void) | null = null;
    createPrivateRoom(gameType, user.id, difficulty)
      .then(async (room) => {
        setHostRoom(room);
        unsub = await watchRoomGuest(room.room_code, (r) => {
          if (r.guest_user_id) onReady(r, "w");
        });
      })
      .catch((e) => toast.error(e.message ?? "Failed to create room"));
    return () => { if (unsub) unsub(); };
  }, [tab, user, hostRoom, gameType, difficulty, onReady]);

  // Quick match
  useEffect(() => {
    if (tab !== "quick" || !user) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const r = await enterQuickMatch(gameType, user.id, difficulty, 1200);
      if (cancelled) return;
      if (!r.isHost && r.roomCode) {
        // We joined, fetch room & start as black (guest)
        const { default: supa } = await import("@/integrations/supabase/client").then((m) => ({ default: m.supabase }));
        const { data } = await supa.from("minigame_rooms").select("*").eq("room_code", r.roomCode).maybeSingle();
        if (data) onReady(data as RoomRow, "b");
        return;
      }
      // We are the waiter — watch our queue row
      unsub = await watchMyQueue(user.id, gameType, async (row) => {
        if (!row.room_code) return;
        const { default: supa } = await import("@/integrations/supabase/client").then((m) => ({ default: m.supabase }));
        const { data } = await supa.from("minigame_rooms").select("*").eq("room_code", row.room_code).maybeSingle();
        if (data) onReady(data as RoomRow, "w");
      });
    })();
    return () => { cancelled = true; if (unsub) unsub(); if (user) cancelQueue(user.id, gameType); };
  }, [tab, user, gameType, difficulty, onReady]);

  const submitJoin = async () => {
    if (!user || !joinCode.trim()) return;
    setJoining(true);
    try {
      const room = await joinByCode(joinCode, user.id);
      onReady(room, "b");
    } catch (e: any) {
      toast.error(e.message ?? "Could not join");
    } finally {
      setJoining(false);
    }
  };

  const copy = () => {
    if (hostRoom) {
      navigator.clipboard.writeText(hostRoom.room_code);
      toast.success("Code copied");
    }
  };

  return (
    <Card className="mx-auto max-w-md p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <h2 className="text-base font-bold">Online · {difficulty}</h2>
      </div>

      {tab === "choose" && (
        <div className="grid gap-2">
          <Button onClick={() => setTab("quick")}>Quick Match</Button>
          <Button variant="secondary" onClick={() => setTab("host")}>Create Private Room</Button>
          <Button variant="secondary" onClick={() => setTab("join")}>Join with Code</Button>
        </div>
      )}

      {tab === "host" && (
        <div className="text-center space-y-3">
          {hostRoom ? (
            <>
              <p className="text-xs text-muted-foreground">Share this code with your friend</p>
              <div className="text-4xl font-mono font-bold tracking-widest">{hostRoom.room_code}</div>
              <Button size="sm" variant="secondary" onClick={copy}><Copy className="h-3 w-3 mr-1" />Copy</Button>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for opponent…
              </div>
            </>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          )}
        </div>
      )}

      {tab === "join" && (
        <div className="space-y-2">
          <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder="ABC123" className="text-center text-lg font-mono tracking-widest" />
          <Button onClick={submitJoin} disabled={joining || joinCode.length !== 6} className="w-full">
            {joining ? "Joining…" : "Join Room"}
          </Button>
        </div>
      )}

      {tab === "quick" && (
        <div className="text-center space-y-3 py-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm">Finding an opponent…</p>
          <p className="text-xs text-muted-foreground">Stay on this screen</p>
        </div>
      )}
    </Card>
  );
}
