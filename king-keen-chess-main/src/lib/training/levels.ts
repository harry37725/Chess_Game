// World metadata + helpers for the training world map.

export type LevelType =
  | "tutorial"
  | "find-move"
  | "survive"
  | "clock"
  | "checkmate"
  | "opening"
  | "boss";

export type TrainingLevel = {
  id: string;
  world: number;
  level_number: number;
  type: LevelType;
  title: string;
  goal: string;
  coach_hint: string | null;
  fen: string;
  solution_uci: string | null;
  difficulty: number;
  move_limit: number | null;
};

export type WorldMeta = {
  num: number;
  title: string;
  blurb: string;
  bgClass: string; // tailwind background gradient
  accent: string; // hex/oklch for path + node ring
  emoji: string;
};

export const WORLDS: WorldMeta[] = [
  { num: 1, title: "The Pawn Fields",        blurb: "Learn how the pieces move", bgClass: "from-emerald-900 via-emerald-800 to-green-900", accent: "#a7f3d0", emoji: "🌾" },
  { num: 2, title: "The Knight's Forest",    blurb: "Tactics in the woods",      bgClass: "from-green-950 via-emerald-950 to-slate-900",  accent: "#86efac", emoji: "🌲" },
  { num: 3, title: "The Bishop's Cathedral", blurb: "Diagonals & pins",          bgClass: "from-purple-900 via-violet-900 to-indigo-950", accent: "#d8b4fe", emoji: "⛪" },
  { num: 4, title: "The Rook's Fortress",    blurb: "Files, ranks & power",      bgClass: "from-slate-700 via-slate-800 to-slate-900",   accent: "#cbd5e1", emoji: "🏰" },
  { num: 5, title: "The Queen's Domain",     blurb: "Royal calculation",         bgClass: "from-amber-700 via-yellow-700 to-amber-900",  accent: "#fde68a", emoji: "👑" },
  { num: 6, title: "The King's Court",       blurb: "Master challenge",          bgClass: "from-red-900 via-rose-950 to-black",          accent: "#fecaca", emoji: "♚" },
];

export function getWorld(n: number) {
  return WORLDS.find((w) => w.num === n) ?? WORLDS[0];
}

// A level is unlocked iff it is the first level of W1, OR the previous level in
// the same world is completed, OR (it's level 1 of a world) the boss of the previous world is completed.
export function isLevelUnlocked(
  level: TrainingLevel,
  allLevels: TrainingLevel[],
  completedIds: Set<string>,
): boolean {
  if (level.world === 1 && level.level_number === 1) return true;
  if (level.level_number > 1) {
    const prev = allLevels.find((l) => l.world === level.world && l.level_number === level.level_number - 1);
    return !!prev && completedIds.has(prev.id);
  }
  // first level of a new world: previous world's boss must be done
  const prevBoss = allLevels.find((l) => l.world === level.world - 1 && l.type === "boss");
  return !!prevBoss && completedIds.has(prevBoss.id);
}

export function coinsForStars(stars: number, type: LevelType) {
  const base = type === "boss" ? 50 : type === "tutorial" ? 8 : 15;
  return base + stars * (type === "boss" ? 30 : 10);
}
