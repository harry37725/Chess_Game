import type { MiniGameId, PlayMode } from "./types";

export type GameMeta = {
  id: MiniGameId;
  title: string;
  emoji: string;
  blurb: string;
  modes: Record<PlayMode, { available: boolean; reason?: string }>;
  difficulties: Array<"easy" | "medium" | "hard">;
};

export const MINIGAMES: GameMeta[] = [
  {
    id: "knights-tour",
    title: "Knight's Tour",
    emoji: "🐴",
    blurb: "Visit every square exactly once with a single knight.",
    modes: {
      ai: { available: false, reason: "Knight's Tour is a solo challenge." },
      local: { available: true },
      online: { available: true },
    },
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "king-of-the-hill",
    title: "King of the Hill",
    emoji: "👑",
    blurb: "Race your king to one of the four golden center squares.",
    modes: { ai: { available: true }, local: { available: true }, online: { available: true } },
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "pawn-wars",
    title: "Pawn Wars",
    emoji: "♟️",
    blurb: "Eight pawns each. First to promote wins.",
    modes: { ai: { available: true }, local: { available: true }, online: { available: true } },
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "fog-of-war",
    title: "Fog of War",
    emoji: "🌫️",
    blurb: "Only see what your pieces control. Checkmate the unseen king.",
    modes: { ai: { available: true }, local: { available: true }, online: { available: true } },
    difficulties: ["easy", "medium", "hard"],
  },
  {
    id: "piece-survival",
    title: "Piece Survival",
    emoji: "🏹",
    blurb: "Survive 10 moves against a hunting queen.",
    modes: { ai: { available: true }, local: { available: true }, online: { available: true } },
    difficulties: ["easy", "medium", "hard"],
  },
];

export const getGame = (id: string): GameMeta | undefined => MINIGAMES.find((g) => g.id === id);
