import { supabase } from "@/integrations/supabase/client";

export type GameResult = "win" | "loss" | "draw";

export async function saveGameHistory(params: {
  result: GameResult;
  opponent: string;
  mode: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("game_history").insert({
    user_id: user.id,
    result: params.result,
    opponent: params.opponent,
    mode: params.mode,
  });
}
