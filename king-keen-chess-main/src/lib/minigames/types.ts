export type MiniGameId =
  | "knights-tour"
  | "king-of-the-hill"
  | "pawn-wars"
  | "fog-of-war"
  | "piece-survival";

export type PlayMode = "ai" | "local" | "online";
export type Difficulty = "easy" | "medium" | "hard";
export type Role = "survivor" | "hunter";

export type RoomRow = {
  room_code: string;
  game_type: MiniGameId;
  host_user_id: string;
  guest_user_id: string | null;
  host_role: Role | null;
  guest_role: Role | null;
  status: "waiting" | "active" | "finished";
  difficulty: Difficulty;
  config: Record<string, unknown>;
  created_at: string;
  last_activity_at: string;
};
