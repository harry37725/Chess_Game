
-- ============================================================
-- 1.  Security-definer RPC so the acceptor can insert the
--     OTHER user's friendship row (RLS only lets each user
--     insert their own row_user_id = auth.uid()).
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_friendship_for_user(
  p_user_id   UUID,
  p_friend_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) TO authenticated;

-- ============================================================
-- 2.  Security-definer RPC to remove both sides of a
--     friendship atomically (RLS only lets users delete their
--     own side, so we need a definer function for the pair).
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_friendship(
  p_user_id   UUID,
  p_friend_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only let the calling user remove their own friendships
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.friendships
  WHERE (user_id = p_user_id   AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = p_user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_friendship(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_friendship(uuid, uuid) TO authenticated;

-- ============================================================
-- 3.  Fix matchmaking_queue UPDATE policy so that the
--     *claimer* (the person setting opponent_id) can also
--     update the row.  Previously the policy required
--     auth.uid() = user_id OR auth.uid() = opponent_id, but
--     opponent_id is NULL at the time of the claim so only
--     user_id matched — meaning no one else could claim.
--     We relax this to allow any authenticated user to update
--     (the application-level .is("opponent_id", null) guard
--     and the optimistic-lock pattern prevent races).
-- ============================================================
DROP POLICY IF EXISTS mq_update_involved ON public.matchmaking_queue;
CREATE POLICY mq_update_involved ON public.matchmaking_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4.  Make sure friendships table is in the realtime
--     publication so the friends page reacts live.
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
