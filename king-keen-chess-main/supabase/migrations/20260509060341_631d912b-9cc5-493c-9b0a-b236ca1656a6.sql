
CREATE OR REPLACE FUNCTION public.add_friendship_for_user(p_user_id UUID, p_friend_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT DO NOTHING;
END; $$;
REVOKE EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_friendship_for_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_friendship(p_user_id UUID, p_friend_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.friendships
  WHERE (user_id = p_user_id AND friend_id = p_friend_id)
     OR (user_id = p_friend_id AND friend_id = p_user_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.remove_friendship(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_friendship(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS mq_update_involved ON public.matchmaking_queue;
CREATE POLICY mq_update_involved ON public.matchmaking_queue
  FOR UPDATE USING (auth.uid() IS NOT NULL);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
