import { supabase } from "@/integrations/supabase/client";
import type { Difficulty, MiniGameId, PlayMode } from "./types";

export async function recordScore(args: {
  userId: string;
  gameType: MiniGameId;
  mode: PlayMode;
  difficulty: Difficulty;
  stars: number;
  completionTimeSeconds?: number | null;
  won: boolean;
}) {
  const { userId, gameType, mode, difficulty, stars, completionTimeSeconds, won } = args;
  await supabase.from("minigame_scores").insert({
    user_id: userId, game_type: gameType, mode, difficulty, stars,
    completion_time_seconds: completionTimeSeconds ?? null, won,
  });

  // Upsert personal best
  const { data: existing } = await supabase
    .from("minigame_personal_bests")
    .select("*").eq("user_id", userId).eq("game_type", gameType).maybeSingle();
  const next = {
    user_id: userId,
    game_type: gameType,
    best_stars: Math.max(existing?.best_stars ?? 0, stars),
    best_time_seconds:
      completionTimeSeconds != null
        ? Math.min(existing?.best_time_seconds ?? Number.MAX_SAFE_INTEGER, completionTimeSeconds)
        : existing?.best_time_seconds ?? null,
    total_plays: (existing?.total_plays ?? 0) + 1,
    wins: (existing?.wins ?? 0) + (won ? 1 : 0),
    losses: (existing?.losses ?? 0) + (won ? 0 : 1),
    last_played_at: new Date().toISOString(),
  };
  await supabase.from("minigame_personal_bests").upsert(next);

  if (mode === "online") await applyMinigameElo(userId, won);
}

export async function applyMinigameElo(userId: string, won: boolean) {
  const delta = won ? 15 : -15;
  const { data } = await supabase.from("profiles").select("minigame_rating").eq("id", userId).maybeSingle();
  const cur = data?.minigame_rating ?? 1200;
  await supabase.from("profiles").update({ minigame_rating: Math.max(100, cur + delta) }).eq("id", userId);
}
