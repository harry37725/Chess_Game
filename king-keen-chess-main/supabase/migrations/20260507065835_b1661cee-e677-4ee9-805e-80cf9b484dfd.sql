
-- 1. Profiles: add friend_code + rating, allow public view
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS rating INT NOT NULL DEFAULT 1200;

-- replace restrictive select with public select (needed for friends/matchmaking display)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

-- friend code generator
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  code TEXT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    PERFORM 1 FROM public.profiles WHERE friend_code = code;
    IF NOT FOUND THEN done := true; END IF;
  END LOOP;
  RETURN code;
END;
$$ SET search_path = public;

-- backfill
UPDATE public.profiles SET friend_code = public.generate_friend_code() WHERE friend_code IS NULL;

-- update handle_new_user trigger to assign friend_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, friend_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    public.generate_friend_code()
  );
  RETURN NEW;
END;
$$;

-- ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Friendships (symmetric: insert two rows)
CREATE TABLE IF NOT EXISTS public.friendships (
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select_own" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "friendships_insert_own" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "friendships_delete_own" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Friend requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / accepted / declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select_involved" ON public.friend_requests
  FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "fr_insert_from_self" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "fr_update_to_self" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = to_user);
CREATE POLICY "fr_delete_involved" ON public.friend_requests
  FOR DELETE USING (auth.uid() = from_user OR auth.uid() = to_user);

-- 4. Matchmaking queue
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  user_id UUID PRIMARY KEY,
  rating INT NOT NULL DEFAULT 1200,
  min_rating INT NOT NULL DEFAULT 0,
  max_rating INT NOT NULL DEFAULT 4000,
  room_id TEXT,
  opponent_id UUID,
  color TEXT, -- 'w' or 'b'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
-- public read so clients can find compatible opponents
CREATE POLICY "mq_select_all" ON public.matchmaking_queue
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mq_insert_self" ON public.matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mq_update_involved" ON public.matchmaking_queue
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = opponent_id);
CREATE POLICY "mq_delete_self" ON public.matchmaking_queue
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Direct game invites (challenge a friend)
CREATE TABLE IF NOT EXISTS public.game_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / accepted / declined / cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gi_select_involved" ON public.game_invites
  FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "gi_insert_from_self" ON public.game_invites
  FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "gi_update_involved" ON public.game_invites
  FOR UPDATE USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "gi_delete_involved" ON public.game_invites
  FOR DELETE USING (auth.uid() = from_user OR auth.uid() = to_user);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
