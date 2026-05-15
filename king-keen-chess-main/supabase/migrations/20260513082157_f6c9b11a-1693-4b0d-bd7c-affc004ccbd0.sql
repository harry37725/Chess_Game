-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  country text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.game_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('win','loss','draw')),
  opponent text not null,
  mode text not null,
  played_at timestamptz not null default now()
);

alter table public.game_history enable row level security;

create policy "history_select_own" on public.game_history for select using (auth.uid() = user_id);
create policy "history_insert_own" on public.game_history for insert with check (auth.uid() = user_id);
create policy "history_delete_own" on public.game_history for delete using (auth.uid() = user_id);

create index game_history_user_played_idx on public.game_history(user_id, played_at desc);
revoke execute on function public.handle_new_user() from anon, authenticated, public;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS rating INT NOT NULL DEFAULT 1200;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

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

UPDATE public.profiles SET friend_code = public.generate_friend_code() WHERE friend_code IS NULL;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "friendships_insert_own" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user)
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select_involved" ON public.friend_requests FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "fr_insert_from_self" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "fr_update_to_self" ON public.friend_requests FOR UPDATE USING (auth.uid() = to_user);
CREATE POLICY "fr_delete_involved" ON public.friend_requests FOR DELETE USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  user_id UUID PRIMARY KEY,
  rating INT NOT NULL DEFAULT 1200,
  min_rating INT NOT NULL DEFAULT 0,
  max_rating INT NOT NULL DEFAULT 4000,
  room_id TEXT,
  opponent_id UUID,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mq_select_all" ON public.matchmaking_queue FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mq_insert_self" ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mq_update_involved" ON public.matchmaking_queue FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = opponent_id);
CREATE POLICY "mq_delete_self" ON public.matchmaking_queue FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.game_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  room_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gi_select_involved" ON public.game_invites FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "gi_insert_from_self" ON public.game_invites FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "gi_update_involved" ON public.game_invites FOR UPDATE USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "gi_delete_involved" ON public.game_invites FOR DELETE USING (auth.uid() = from_user OR auth.uid() = to_user);

ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;

CREATE TABLE IF NOT EXISTS public.active_games (
  room_id text PRIMARY KEY,
  white_user uuid NOT NULL,
  black_user uuid NOT NULL,
  white_username text,
  black_username text,
  started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.active_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY ag_select_authenticated ON public.active_games FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY ag_insert_self ON public.active_games FOR INSERT WITH CHECK (auth.uid() = white_user OR auth.uid() = black_user);
CREATE POLICY ag_delete_involved ON public.active_games FOR DELETE USING (auth.uid() = white_user OR auth.uid() = black_user);
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_games;

CREATE OR REPLACE FUNCTION public.apply_match_result(
  p_white uuid, p_black uuid, p_result numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rw int; rb int; ew numeric; eb numeric; k int := 32; caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR (caller <> p_white AND caller <> p_black) THEN RAISE EXCEPTION 'not a participant'; END IF;
  SELECT rating INTO rw FROM public.profiles WHERE id = p_white;
  SELECT rating INTO rb FROM public.profiles WHERE id = p_black;
  IF rw IS NULL OR rb IS NULL THEN RETURN; END IF;
  ew := 1.0 / (1.0 + power(10, (rb - rw) / 400.0));
  eb := 1.0 - ew;
  UPDATE public.profiles SET rating = GREATEST(100, rw + round(k * (p_result - ew))::int) WHERE id = p_white;
  UPDATE public.profiles SET rating = GREATEST(100, rb + round(k * ((1.0 - p_result) - eb))::int) WHERE id = p_black;
END; $$;
REVOKE EXECUTE ON FUNCTION public.apply_match_result(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_match_result(uuid,uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_friendship_for_user(
  p_user_id UUID, p_friend_id UUID
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.friendships (user_id, friend_id) VALUES (p_user_id, p_friend_id) ON CONFLICT DO NOTHING;
END; $$;
REVOKE EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) TO authenticated;