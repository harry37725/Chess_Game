import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { TrainingLevel } from "./levels";
import { coinsForStars } from "./levels";

export const MAX_LIVES = 5;
export const REGEN_MS = 30 * 60 * 1000;

export type Stats = {
  user_id: string;
  lives: number;
  last_life_lost_at: string | null;
  coins: number;
  total_stars: number;
  streak: number;
  last_played_at: string | null;
  current_world: number;
  current_level_number: number;
};

export type LevelProgress = {
  level_id: string;
  stars: number;
  attempts: number;
  completed_at: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function applyRegen(s: Stats): Stats {
  if (s.lives >= MAX_LIVES || !s.last_life_lost_at) return s;
  const elapsed = Date.now() - +new Date(s.last_life_lost_at);
  const gained = Math.floor(elapsed / REGEN_MS);
  if (gained <= 0) return s;
  const lives = Math.min(MAX_LIVES, s.lives + gained);
  const last_life_lost_at =
    lives >= MAX_LIVES ? null : new Date(+new Date(s.last_life_lost_at) + gained * REGEN_MS).toISOString();
  return { ...s, lives, last_life_lost_at };
}

export function useTrainingState() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [levels, setLevels] = useState<TrainingLevel[]>([]);
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const [{ data: lv }, { data: pg }, { data: st }] = await Promise.all([
      supabase.from("training_levels").select("*").order("world").order("level_number"),
      supabase.from("user_level_progress").select("*").eq("user_id", user.id),
      supabase.from("user_training_stats").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setLevels((lv ?? []) as TrainingLevel[]);
    const pmap: Record<string, LevelProgress> = {};
    (pg ?? []).forEach((p: any) => { pmap[p.level_id] = p; });
    setProgress(pmap);

    let s: Stats | null = (st as Stats) ?? null;
    if (!s) {
      const { data } = await supabase.from("user_training_stats").insert({ user_id: user.id }).select().maybeSingle();
      s = (data as Stats) ?? null;
    }
    if (s) {
      const regen = applyRegen(s);
      if (regen.lives !== s.lives || regen.last_life_lost_at !== s.last_life_lost_at) {
        await supabase.from("user_training_stats")
          .update({ lives: regen.lives, last_life_lost_at: regen.last_life_lost_at })
          .eq("user_id", user.id);
        s = regen;
      }
    }
    setStats(s);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  // tick every 30s to refresh regen UI
  useEffect(() => {
    const id = setInterval(() => {
      setStats((cur) => (cur ? applyRegen(cur) : cur));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const loseLife = useCallback(async () => {
    if (!user || !stats) return;
    if (stats.lives <= 0) return;
    const lives = stats.lives - 1;
    const last_life_lost_at = stats.lives === MAX_LIVES ? new Date().toISOString() : stats.last_life_lost_at;
    const next = { ...stats, lives, last_life_lost_at };
    setStats(next);
    await supabase.from("user_training_stats")
      .update({ lives, last_life_lost_at })
      .eq("user_id", user.id);
  }, [user?.id, stats]);

  const bumpStreak = useCallback(async (current: Stats): Promise<Stats> => {
    if (!user) return current;
    const today = todayISO();
    if (current.last_played_at === today) return current;
    let streak = 1;
    if (current.last_played_at) {
      const diff = Math.floor((+new Date(today) - +new Date(current.last_played_at)) / 86_400_000);
      streak = diff === 1 ? current.streak + 1 : 1;
    }
    await supabase.from("training_streak_days").insert({ user_id: user.id, date: today }).then(() => {});
    const next = { ...current, streak, last_played_at: today };
    return next;
  }, [user?.id]);

  const completeLevel = useCallback(
    async (level: TrainingLevel, stars: number) => {
      if (!user || !stats) return;
      const prev = progress[level.id];
      const bestStars = Math.max(prev?.stars ?? 0, stars);
      const isFirstClear = !prev?.completed_at;
      const earnedStars = bestStars - (prev?.stars ?? 0);
      const coins = isFirstClear ? coinsForStars(stars, level.type) : Math.max(0, stars - (prev?.stars ?? 0)) * 10;

      // upsert progress
      const newProg: LevelProgress = {
        level_id: level.id,
        stars: bestStars,
        attempts: (prev?.attempts ?? 0) + 1,
        completed_at: prev?.completed_at ?? new Date().toISOString(),
      };
      await supabase.from("user_level_progress").upsert({
        user_id: user.id,
        level_id: level.id,
        stars: bestStars,
        attempts: newProg.attempts,
        completed_at: newProg.completed_at,
        updated_at: new Date().toISOString(),
      });
      setProgress((p) => ({ ...p, [level.id]: newProg }));

      // bump stats
      let next: Stats = {
        ...stats,
        coins: stats.coins + coins,
        total_stars: stats.total_stars + earnedStars,
        current_world: level.world,
        current_level_number: level.level_number,
      };
      next = await bumpStreak(next);
      await supabase.from("user_training_stats").update({
        coins: next.coins,
        total_stars: next.total_stars,
        current_world: next.current_world,
        current_level_number: next.current_level_number,
        streak: next.streak,
        last_played_at: next.last_played_at,
      }).eq("user_id", user.id);
      setStats(next);
      return { coinsEarned: coins, starsGained: earnedStars, isFirstClear, totalStars: bestStars };
    },
    [user?.id, stats, progress, bumpStreak],
  );

  const failLevel = useCallback(async (level: TrainingLevel) => {
    if (!user) return;
    const prev = progress[level.id];
    await supabase.from("user_level_progress").upsert({
      user_id: user.id,
      level_id: level.id,
      stars: prev?.stars ?? 0,
      attempts: (prev?.attempts ?? 0) + 1,
      completed_at: prev?.completed_at ?? null,
      updated_at: new Date().toISOString(),
    });
    setProgress((p) => ({
      ...p,
      [level.id]: {
        level_id: level.id,
        stars: prev?.stars ?? 0,
        attempts: (prev?.attempts ?? 0) + 1,
        completed_at: prev?.completed_at ?? null,
      },
    }));
  }, [user?.id, progress]);

  return { stats, levels, progress, loading, completeLevel, failLevel, loseLife, reload: load };
}

export function regenCountdown(stats: Stats | null): string | null {
  if (!stats || stats.lives >= MAX_LIVES || !stats.last_life_lost_at) return null;
  const remaining = REGEN_MS - ((Date.now() - +new Date(stats.last_life_lost_at)) % REGEN_MS);
  const m = Math.floor(remaining / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
