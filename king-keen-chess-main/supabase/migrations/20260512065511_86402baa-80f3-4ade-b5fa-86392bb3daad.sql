
-- Mini Games rating
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS minigame_rating integer NOT NULL DEFAULT 1200;

-- Rooms
CREATE TABLE IF NOT EXISTS public.minigame_rooms (
  room_code text PRIMARY KEY,
  game_type text NOT NULL,
  host_user_id uuid NOT NULL,
  guest_user_id uuid,
  host_role text,
  guest_role text,
  status text NOT NULL DEFAULT 'waiting',
  difficulty text NOT NULL DEFAULT 'medium',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.minigame_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mr_select_auth" ON public.minigame_rooms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mr_insert_host" ON public.minigame_rooms FOR INSERT WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "mr_update_involved" ON public.minigame_rooms FOR UPDATE USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id OR (guest_user_id IS NULL AND auth.uid() IS NOT NULL));
CREATE POLICY "mr_delete_host" ON public.minigame_rooms FOR DELETE USING (auth.uid() = host_user_id);

-- Queue
CREATE TABLE IF NOT EXISTS public.minigame_queue (
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  rating integer NOT NULL DEFAULT 1200,
  joined_at timestamptz NOT NULL DEFAULT now(),
  matched boolean NOT NULL DEFAULT false,
  room_code text,
  opponent_id uuid,
  PRIMARY KEY (user_id, game_type)
);
ALTER TABLE public.minigame_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mq_select_auth" ON public.minigame_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mq_insert_self" ON public.minigame_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mq_update_any" ON public.minigame_queue FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "mq_delete_self" ON public.minigame_queue FOR DELETE USING (auth.uid() = user_id);

-- Scores log
CREATE TABLE IF NOT EXISTS public.minigame_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  mode text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  stars integer NOT NULL DEFAULT 0,
  completion_time_seconds integer,
  won boolean NOT NULL DEFAULT false,
  played_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.minigame_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_select_public" ON public.minigame_scores FOR SELECT USING (true);
CREATE POLICY "ms_insert_self" ON public.minigame_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Personal bests
CREATE TABLE IF NOT EXISTS public.minigame_personal_bests (
  user_id uuid NOT NULL,
  game_type text NOT NULL,
  best_stars integer NOT NULL DEFAULT 0,
  best_time_seconds integer,
  total_plays integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  last_played_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_type)
);
ALTER TABLE public.minigame_personal_bests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mpb_select_public" ON public.minigame_personal_bests FOR SELECT USING (true);
CREATE POLICY "mpb_insert_self" ON public.minigame_personal_bests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mpb_update_self" ON public.minigame_personal_bests FOR UPDATE USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.minigame_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.minigame_queue;
