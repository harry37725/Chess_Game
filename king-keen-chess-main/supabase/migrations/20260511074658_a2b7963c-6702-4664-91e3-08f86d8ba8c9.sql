-- Drop old training tables
DROP TABLE IF EXISTS public.training_progress CASCADE;
DROP TABLE IF EXISTS public.training_streaks CASCADE;
DROP TABLE IF EXISTS public.puzzles CASCADE;

-- training_levels (catalog)
CREATE TABLE public.training_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world int NOT NULL,
  level_number int NOT NULL,
  type text NOT NULL CHECK (type IN ('tutorial','find-move','survive','clock','checkmate','opening','boss')),
  title text NOT NULL,
  goal text NOT NULL,
  coach_hint text,
  fen text NOT NULL,
  solution_uci text,
  difficulty int NOT NULL DEFAULT 1,
  move_limit int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (world, level_number)
);
ALTER TABLE public.training_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tl_select_auth ON public.training_levels FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_level_progress
CREATE TABLE public.user_level_progress (
  user_id uuid NOT NULL,
  level_id uuid NOT NULL REFERENCES public.training_levels(id) ON DELETE CASCADE,
  stars int NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  attempts int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level_id)
);
ALTER TABLE public.user_level_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY ulp_select_own ON public.user_level_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ulp_insert_own ON public.user_level_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ulp_update_own ON public.user_level_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ulp_delete_own ON public.user_level_progress FOR DELETE USING (auth.uid() = user_id);

-- user_training_stats
CREATE TABLE public.user_training_stats (
  user_id uuid PRIMARY KEY,
  lives int NOT NULL DEFAULT 5 CHECK (lives BETWEEN 0 AND 5),
  last_life_lost_at timestamptz,
  coins int NOT NULL DEFAULT 0,
  total_stars int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  last_played_at date,
  current_world int NOT NULL DEFAULT 1,
  current_level_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_training_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY uts_select_own ON public.user_training_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY uts_insert_own ON public.user_training_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY uts_update_own ON public.user_training_stats FOR UPDATE USING (auth.uid() = user_id);

-- training_streak_days
CREATE TABLE public.training_streak_days (
  user_id uuid NOT NULL,
  date date NOT NULL,
  PRIMARY KEY (user_id, date)
);
ALTER TABLE public.training_streak_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsd_select_own ON public.training_streak_days FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tsd_insert_own ON public.training_streak_days FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed World 1 (tutorial)
-- White king on h1 (7K) and black king on h8 (7k) — both tucked in far corners
-- so only the puzzle piece(s) are visible in the center of the board.
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(1,1,'tutorial','The Rook Walks','Move the rook to a5','Rooks slide along files!',
  '7k/8/8/8/8/8/8/R6K w - - 0 1', 'a1a5', 1, 1),
(1,2,'tutorial','Rook Capture','Capture the pawn on a6','Take the pawn!',
  '7k/8/p7/8/8/8/8/R6K w - - 0 1', 'a1a6', 1, 1),
(1,3,'tutorial','The Knight Jumps','Land the knight on f5','Knights jump in an L!',
  '7k/8/8/8/3N4/8/8/7K w - - 0 1', 'd4f5', 1, 1),
(1,4,'tutorial','Knight in 2','Reach b3 in 2 moves','Plan ahead!',
  '7k/8/8/8/8/8/8/N6K w - - 0 1', 'a1c2;c2b3', 1, 2),
(1,5,'tutorial','The Bishop''s Diagonal','Move the bishop to g7','Bishops love diagonals!',
  '7k/8/8/8/3B4/8/8/7K w - - 0 1', 'd4g7', 1, 1),
(1,6,'tutorial','Pawn Push','Move the pawn to e4','Two squares from start!',
  '7k/8/8/8/8/8/4P3/7K w - - 0 1', 'e2e4', 1, 1),
(1,7,'tutorial','Pawn Capture','Capture the knight with your pawn','Pawns capture diagonally!',
  '7k/8/8/4n3/3P4/8/8/7K w - - 0 1', 'd4e5', 1, 1),
(1,8,'tutorial','Mini Checkmate','Checkmate the king in 1','Corner the King!',
  '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', 1, 1);

-- World 2 — Knight's Forest
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(2,1,'find-move','Fork the King and Queen','Find the knight fork','Knights are master forkers', 'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 5', 'f3g5', 2, 1),
(2,2,'checkmate','Mate in 1','Deliver mate', 'Back rank!', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', 2, 1),
(2,3,'find-move','Win Material','Find the winning move', 'Look for tactics', 'r3k2r/ppp2ppp/2n5/3qp3/3P4/2N5/PPP2PPP/R2QK2R w KQkq - 0 8', 'd4e5', 2, 1),
(2,4,'survive','Survive 5 Moves','Don''t blunder', 'Stay solid', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 2, 5),
(2,5,'boss','Forest Boss','Beat the bot', 'You can do it!', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 2, NULL);

-- World 3 — Bishop's Cathedral
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(3,1,'opening','Italian Game','Play the opening', 'e4 e5 Nf3 Nc6 Bc4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4;g1f3;f1c4', 3, 3),
(3,2,'find-move','Pin to Win','Find the pin', 'Freeze a piece', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 4', 'f1b5', 3, 1),
(3,3,'checkmate','Mate in 2','Find the combination', 'Force it', '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a8', 3, 1),
(3,4,'clock','Beat the Clock','Solve fast', '60 seconds', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', 3, NULL),
(3,5,'boss','Cathedral Boss','Beat the bot', 'Bishop pair power!', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 3, NULL);

-- World 4 — Rook's Fortress
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(4,1,'opening','Queen''s Gambit','Play the opening', 'd4 d5 c4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'd2d4;c2c4', 3, 2),
(4,2,'find-move','Skewer!','Find the skewer', 'Force the move', '4k3/8/8/8/8/8/4q3/R6K w - - 0 1', 'a1e1', 3, 1),
(4,3,'survive','Hold the Fortress','Survive 6 moves', 'Stay alert', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 3, 6),
(4,4,'checkmate','Rook Mate','Mate in 1', 'Use the corner', '7k/8/6K1/8/8/8/8/R7 w - - 0 1', 'a1a8', 3, 1),
(4,5,'boss','Fortress Boss','Beat the bot', 'Rooks rule!', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 4, NULL);

-- World 5 — Queen's Domain
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(5,1,'opening','Sicilian Defense','Play the moves', 'e4 c5 Nf3', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e4;g1f3', 4, 2),
(5,2,'find-move','Queen Tactic','Find the move', 'Queen power', '4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'd1d8', 4, 1),
(5,3,'clock','Lightning Round','Solve under pressure', 'Quick!', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', 4, NULL),
(5,4,'checkmate','Queen Mate','Mate in 1', 'Use the queen', '4k3/4Q3/4K3/8/8/8/8/8 w - - 0 1', 'e7e8', 4, 1),
(5,5,'boss','Queen''s Boss','Beat the bot', 'Royal battle!', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 4, NULL);

-- World 6 — King's Court
INSERT INTO public.training_levels (world, level_number, type, title, goal, coach_hint, fen, solution_uci, difficulty, move_limit) VALUES
(6,1,'opening','London System','Play the moves', 'd4 Nf3 Bf4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'd2d4;g1f3;c1f4', 5, 3),
(6,2,'survive','Royal Defense','Survive 8 moves', 'Don''t crack', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 5, 8),
(6,3,'checkmate','Mate in 1','Find it', 'King hunt', '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1', 'g7g8', 5, 1),
(6,4,'clock','Final Sprint','Solve fast', 'Move quickly', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1a8', 5, NULL),
(6,5,'boss','The King''s Court','Defeat the master', 'You are ready!', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', NULL, 5, NULL);
