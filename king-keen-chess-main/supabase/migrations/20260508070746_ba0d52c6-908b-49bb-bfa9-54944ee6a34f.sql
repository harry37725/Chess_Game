
-- Active games table (one row per live online match)
CREATE TABLE IF NOT EXISTS public.active_games (
  room_id text PRIMARY KEY,
  white_user uuid NOT NULL,
  black_user uuid NOT NULL,
  white_username text,
  black_username text,
  started_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_games ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can see active games (so friends can find spectate-able matches)
CREATE POLICY ag_select_authenticated ON public.active_games
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only a participant can insert their own game
CREATE POLICY ag_insert_self ON public.active_games
  FOR INSERT WITH CHECK (auth.uid() = white_user OR auth.uid() = black_user);

-- Either participant can delete the row when the game ends
CREATE POLICY ag_delete_involved ON public.active_games
  FOR DELETE USING (auth.uid() = white_user OR auth.uid() = black_user);

ALTER PUBLICATION supabase_realtime ADD TABLE public.active_games;

-- ELO rating update RPC. Result is from the perspective of white:
-- 1.0 = white wins, 0.5 = draw, 0.0 = black wins.
CREATE OR REPLACE FUNCTION public.apply_match_result(
  p_white uuid,
  p_black uuid,
  p_result numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rw int;
  rb int;
  ew numeric;
  eb numeric;
  k  int := 32;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR (caller <> p_white AND caller <> p_black) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  SELECT rating INTO rw FROM public.profiles WHERE id = p_white;
  SELECT rating INTO rb FROM public.profiles WHERE id = p_black;
  IF rw IS NULL OR rb IS NULL THEN RETURN; END IF;

  ew := 1.0 / (1.0 + power(10, (rb - rw) / 400.0));
  eb := 1.0 - ew;

  UPDATE public.profiles SET rating = GREATEST(100, rw + round(k * (p_result - ew))::int)
    WHERE id = p_white;
  UPDATE public.profiles SET rating = GREATEST(100, rb + round(k * ((1.0 - p_result) - eb))::int)
    WHERE id = p_black;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_match_result(uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_match_result(uuid,uuid,numeric) TO authenticated;
