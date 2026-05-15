
CREATE TABLE public.puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fen TEXT NOT NULL,
  solution_uci TEXT NOT NULL,
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  category TEXT NOT NULL CHECK (category IN ('tactic','endgame','opening')),
  theme TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
CREATE POLICY puzzles_select_auth ON public.puzzles FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TABLE public.training_progress (
  user_id UUID PRIMARY KEY,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  completed_lessons TEXT[] NOT NULL DEFAULT '{}',
  completed_puzzles UUID[] NOT NULL DEFAULT '{}',
  completed_chapters TEXT[] NOT NULL DEFAULT '{}',
  puzzles_solved INT NOT NULL DEFAULT 0,
  current_chapter TEXT NOT NULL DEFAULT 'fundamentals',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY tp_select_own ON public.training_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tp_insert_own ON public.training_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tp_update_own ON public.training_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.training_streaks (
  user_id UUID PRIMARY KEY,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_select_own ON public.training_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ts_insert_own ON public.training_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ts_update_own ON public.training_streaks FOR UPDATE USING (auth.uid() = user_id);
