import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, MiniGameId, RoomRow } from "./types";

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export async function createPrivateRoom(
  gameType: MiniGameId,
  hostUserId: string,
  difficulty: Difficulty,
  hostRole: string | null = null,
  config: Record<string, unknown> = {},
): Promise<RoomRow> {
  for (let i = 0; i < 5; i++) {
    const code = genCode();
    const { data, error } = await supabase
      .from("minigame_rooms")
      .insert({
        room_code: code,
        game_type: gameType,
        host_user_id: hostUserId,
        difficulty,
        host_role: hostRole,
        config: config as any,
      })
      .select()
      .single();
    if (!error && data) return data as RoomRow;
  }
  throw new Error("Could not create a room — try again");
}

export async function joinByCode(code: string, guestUserId: string): Promise<RoomRow> {
  const upper = code.trim().toUpperCase();
  const { data: room } = await supabase
    .from("minigame_rooms")
    .select("*")
    .eq("room_code", upper)
    .maybeSingle();
  if (!room) throw new Error("Room not found");
  if (room.guest_user_id && room.guest_user_id !== guestUserId) throw new Error("Room is full");
  const guestRole = room.host_role === "survivor" ? "hunter" : room.host_role === "hunter" ? "survivor" : null;
  const { data, error } = await supabase
    .from("minigame_rooms")
    .update({ guest_user_id: guestUserId, guest_role: guestRole, status: "active", last_activity_at: new Date().toISOString() })
    .eq("room_code", upper)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to join");
  return data as RoomRow;
}

export async function enterQuickMatch(
  gameType: MiniGameId,
  userId: string,
  difficulty: Difficulty,
  rating: number,
): Promise<{ roomCode: string; isHost: boolean }> {
  // Look for an existing waiter
  const { data: waiters } = await supabase
    .from("minigame_queue")
    .select("*")
    .eq("game_type", gameType)
    .eq("matched", false)
    .neq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(5);
  const candidate = waiters?.[0];
  if (candidate) {
    // Create room and claim
    const room = await createPrivateRoom(gameType, candidate.user_id, difficulty);
    const { data: claimed } = await supabase
      .from("minigame_queue")
      .update({ matched: true, room_code: room.room_code, opponent_id: userId })
      .eq("user_id", candidate.user_id)
      .eq("game_type", gameType)
      .eq("matched", false)
      .select()
      .maybeSingle();
    if (claimed) {
      await supabase.from("minigame_queue").upsert({
        user_id: userId, game_type: gameType, difficulty, rating,
        matched: true, room_code: room.room_code, opponent_id: candidate.user_id,
      });
      // Join as guest
      await joinByCode(room.room_code, userId);
      return { roomCode: room.room_code, isHost: false };
    }
    // Race lost — fall through to insert ourselves
  }
  await supabase.from("minigame_queue").upsert({
    user_id: userId, game_type: gameType, difficulty, rating, matched: false, room_code: null, opponent_id: null,
  });
  return { roomCode: "", isHost: true };
}

export async function cancelQueue(userId: string, gameType: MiniGameId) {
  await supabase.from("minigame_queue").delete().eq("user_id", userId).eq("game_type", gameType);
}

export async function watchMyQueue(
  userId: string,
  gameType: MiniGameId,
  cb: (row: { room_code: string | null; opponent_id: string | null }) => void,
) {
  const ch = supabase
    .channel(`mgq-${userId}-${gameType}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "minigame_queue", filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await supabase
          .from("minigame_queue").select("room_code, opponent_id, game_type")
          .eq("user_id", userId).eq("game_type", gameType).maybeSingle();
        if (data?.room_code) cb({ room_code: data.room_code, opponent_id: data.opponent_id });
      })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export async function watchRoomGuest(roomCode: string, cb: (row: RoomRow) => void) {
  const ch = supabase
    .channel(`mgr-${roomCode}`)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "minigame_rooms", filter: `room_code=eq.${roomCode}` },
      async () => {
        const { data } = await supabase.from("minigame_rooms").select("*").eq("room_code", roomCode).maybeSingle();
        if (data) cb(data as RoomRow);
      })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export async function markFinished(roomCode: string) {
  await supabase.from("minigame_rooms").update({ status: "finished" }).eq("room_code", roomCode);
}
