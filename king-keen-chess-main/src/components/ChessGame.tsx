import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Crown, Flag, Handshake, RotateCcw, Send, Trophy, Home, UserPlus, Loader2, Circle, Users, Music, VolumeX,
} from "lucide-react";
import { findBestMove } from "@/lib/chess-ai";
import { sfx, startMusic, stopMusic, isMusicOn } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { StartScreen, type StartConfig, type Mode } from "./StartScreen";
import { saveGameHistory, type GameResult } from "@/lib/game-history";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useGlobalPresence } from "@/lib/presence";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";


type ChatMsg = { from: string; text: string; ts: number };

const LOCAL_CHANNEL = "knight-chess-room";

type BroadcastPayload =
  | { type: "state"; fen: string; lastMove: { from: Square; to: Square } | null; resultMsg: string | null }
  | { type: "chat"; msg: ChatMsg }
  | { type: "request-state" };

export function ChessGame({ initialRoom, initialColor, initialSpectate }: { initialRoom?: string; initialColor?: "w" | "b"; initialSpectate?: boolean }) {
  const [config, setConfig] = useState<StartConfig | null>(
    initialRoom
      ? initialSpectate
        ? { mode: "spectate", difficulty: 0, color: "w", roomId: initialRoom }
        : { mode: "online", difficulty: 0, color: initialColor ?? "w", roomId: initialRoom }
      : null
  );

  if (!config) return <StartScreen onStart={setConfig} />;

  if (config.mode === "online" && !config.roomId) {
    return <Matchmaker config={config} onReady={(cfg) => setConfig(cfg)} onCancel={() => setConfig(null)} />;
  }

  return (
    <GameBoard
      key={`${config.mode}-${config.roomId ?? config.difficulty}-${config.color}`}
      config={config}
      onExit={() => setConfig(null)}
    />
  );
}

function Matchmaker({ config, onReady, onCancel }: {
  config: StartConfig;
  onReady: (cfg: StartConfig) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState("Looking for opponent…");
  const [me, setMe] = useState<{ id: string; username: string; rating: number } | null>(null);
  const [queueUsers, setQueueUsers] = useState<Array<{ user_id: string; rating: number; username?: string }>>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, rating").eq("id", user.id).single().then(({ data }) => {
      if (data) setMe({ id: user.id, username: data.username ?? "You", rating: data.rating ?? 1200 });
    });
  }, [user?.id]);

  const presenceSelf = me ? { user_id: me.id, username: me.username, rating: me.rating, online_at: new Date().toISOString() } : null;
  const online = useGlobalPresence(presenceSelf);

  const refreshQueue = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("matchmaking_queue")
      .select("user_id, rating")
      .is("opponent_id", null);
    const rows = (data ?? []) as Array<{ user_id: string; rating: number }>;
    if (rows.length) {
      const ids = rows.map((r) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.username]));
      setQueueUsers(rows.map((r) => ({ ...r, username: map.get(r.user_id) ?? "Player" })));
    } else {
      setQueueUsers([]);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshQueue();
    const ch = supabase.channel("mq-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "matchmaking_queue" }, refreshQueue)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refreshQueue]);

  useEffect(() => {
    if (!user) { toast.error("Sign in to play online"); onCancel(); return; }
    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | undefined;
    let channel: RealtimeChannel | undefined;

    const start = async () => {
      const { data: prof } = await supabase.from("profiles").select("rating, username").eq("id", user.id).single();
      const myRating = prof?.rating ?? 1200;

      // Try to find any waiting opponent — no rating filter, pure FIFO
      const tryMatch = async () => {
        if (cancelled) return;
        const { data: waiters } = await supabase
          .from("matchmaking_queue")
          .select("*")
          .is("opponent_id", null)
          .neq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(5);

        const candidate = waiters?.[0];
        if (candidate) {
          const room_id = crypto.randomUUID();
          // Claim the candidate row (optimistic lock: .is("opponent_id", null) prevents double-claim)
          const { data: claimed, error } = await supabase
            .from("matchmaking_queue")
            .update({ opponent_id: user.id, room_id, color: "w" })
            .eq("user_id", candidate.user_id)
            .is("opponent_id", null)
            .select()
            .maybeSingle();
          if (!error && claimed) {
            // We claimed them: delete our own row and start as black
            await supabase.from("matchmaking_queue").delete().eq("user_id", user.id);
            if (!cancelled) onReady({ ...config, roomId: room_id, color: "b" });
            return;
          }
          // Claim failed (race condition) — try again on next poll
        }
      };

      // Insert ourselves into the queue first
      await supabase.from("matchmaking_queue").upsert({
        user_id: user.id,
        rating: myRating,
        min_rating: 0,
        max_rating: 4000,
      });

      // FIX: Subscribe to our row BEFORE calling tryMatch so we never miss the
      // UPDATE that fires when someone else claims us (was a race condition before).
      channel = supabase.channel(`mq-${user.id}`)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "matchmaking_queue",
          filter: `user_id=eq.${user.id}`,
        }, async (payload) => {
          // FIX: payload.new may be a partial diff — re-fetch the full row
          const { data: row } = await supabase
            .from("matchmaking_queue")
            .select("room_id, opponent_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (row?.room_id && row?.opponent_id) {
            cancelled = true;
            supabase.from("matchmaking_queue").delete().eq("user_id", user.id).then(() => {});
            onReady({ ...config, roomId: row.room_id, color: row.color ?? "w" });
          }
        })
        .subscribe(async (status) => {
          // FIX: Only start polling AFTER the channel is confirmed subscribed
          if (status === "SUBSCRIBED" && !cancelled) {
            await tryMatch();
            pollId = setInterval(tryMatch, 3000);
          }
        });
    };
    start();

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      if (channel) supabase.removeChannel(channel);
      supabase.from("matchmaking_queue").delete().eq("user_id", user.id).then(() => {});
    };
  }, [user?.id]);

  const onlineCount = Object.keys(online).length;
  const waitingOthers = queueUsers.filter((q) => q.user_id !== user?.id);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card className="p-8 text-center space-y-4">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
        <h2 className="text-xl font-bold">Finding a match…</h2>
        <p className="text-sm text-muted-foreground">{status}</p>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-primary" />Players in queue
          </h3>
          <Badge variant="secondary">{waitingOthers.length}</Badge>
        </div>
        {waitingOthers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No one else waiting yet. Hang tight…</p>
        ) : (
          <ScrollArea className="max-h-40">
            <div className="space-y-1">
              {waitingOthers.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between text-sm rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Circle className="h-2 w-2 text-green-500 fill-green-500" />
                    <span>{p.username}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Rating {p.rating}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <p className="text-xs text-muted-foreground border-t pt-2">
          {onlineCount} player{onlineCount === 1 ? "" : "s"} online overall
        </p>
      </Card>
    </div>
  );
}

type Mover = "self" | "opponent";

function GameBoard({ config, onExit }: { config: StartConfig; onExit: () => void }) {
  const { user } = useAuth();
  const { mode, difficulty: aiDepth, color: playerColor, roomId } = config;
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [drawOffered, setDrawOffered] = useState<"w" | "b" | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([
    { from: "System", text: "Welcome! Good luck and have fun. ♟", ts: Date.now() },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [boardWidth, setBoardWidth] = useState(560);
  const [opponentName, setOpponentName] = useState<string>("Opponent");
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [alreadyFriends, setAlreadyFriends] = useState(false);
  const [myName, setMyName] = useState<string>("You");
  const [musicOn, setMusicOn] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const localCh = useRef<BroadcastChannel | null>(null);
  const rtCh = useRef<RealtimeChannel | null>(null);

  // Load own username for chat display
  useEffect(() => {
    if (!user) { setMyName("You"); return; }
    supabase.from("profiles").select("username").eq("id", user.id).single().then(({ data }) => {
      if (data?.username) setMyName(data.username);
    });
  }, [user?.id]);

  // Sound effects on move/result
  const prevHistLen = useRef(0);
  useEffect(() => {
    const h = history;
    if (h.length > prevHistLen.current) {
      const last = h[h.length - 1];
      const flags = (last as any)?.flags ?? "";
      if (flags.includes("c") || flags.includes("e")) sfx.capture();
      else sfx.move();
      if (gameRef.current.inCheck() && !gameRef.current.isCheckmate()) setTimeout(() => sfx.check(), 80);
    }
    prevHistLen.current = h.length;
  }, [history]);
  useEffect(() => { if (resultMsg) sfx.end(); }, [resultMsg]);

  const toggleMusic = () => {
    if (musicOn) { stopMusic(); setMusicOn(false); }
    else { startMusic(); setMusicOn(isMusicOn() || true); }
  };
  useEffect(() => () => stopMusic(), []);


  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 560;
      setBoardWidth(Math.min(640, Math.max(280, w - 32)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const turn = gameRef.current.turn();
  const inCheck = gameRef.current.inCheck();

  const checkResult = useCallback(() => {
    const g = gameRef.current;
    let msg: string | null = null;
    if (g.isCheckmate()) {
      const winner = g.turn() === "w" ? "Black" : "White";
      msg = `Checkmate — ${winner} wins! 🏆`;
    } else if (g.isStalemate()) msg = "Stalemate — Draw";
    else if (g.isThreefoldRepetition()) msg = "Draw by repetition";
    else if (g.isInsufficientMaterial()) msg = "Draw — insufficient material";
    else if (g.isDraw()) msg = "Draw";
    if (msg) setResultMsg(msg);
    return msg;
  }, []);

  const broadcastLocal = useCallback((payload: BroadcastPayload) => {
    localCh.current?.postMessage(payload);
  }, []);

  const broadcastRT = useCallback((payload: BroadcastPayload) => {
    rtCh.current?.send({ type: "broadcast", event: "msg", payload });
  }, []);

  const sync = useCallback((newLastMove?: { from: Square; to: Square } | null) => {
    const newFen = gameRef.current.fen();
    setFen(newFen);
    setHistory(gameRef.current.history({ verbose: true }) as Move[]);
    setSelected(null);
    setLegalTargets([]);
    const result = checkResult();
    const lm = newLastMove !== undefined ? newLastMove : lastMove;
    if (mode === "local") broadcastLocal({ type: "state", fen: newFen, lastMove: lm, resultMsg: result });
    if (mode === "online") broadcastRT({ type: "state", fen: newFen, lastMove: lm, resultMsg: result });
  }, [checkResult, mode, broadcastLocal, broadcastRT, lastMove]);

  // Local BroadcastChannel for local-pair (and same-device spectate without roomId)
  useEffect(() => {
    if (mode !== "local" && !(mode === "spectate" && !roomId)) return;
    const ch = new BroadcastChannel(LOCAL_CHANNEL);
    localCh.current = ch;
    ch.onmessage = (e) => {
      const data = e.data as BroadcastPayload;
      if (data.type === "state" && mode === "spectate") {
        try {
          gameRef.current.load(data.fen);
          setFen(data.fen);
          setHistory(gameRef.current.history({ verbose: true }) as Move[]);
          setLastMove(data.lastMove);
          setResultMsg(data.resultMsg);
        } catch {/*ignore*/}
      } else if (data.type === "chat") setChat((c) => [...c, data.msg]);
      else if (data.type === "request-state" && mode === "local") {
        ch.postMessage({ type: "state", fen: gameRef.current.fen(), lastMove, resultMsg });
      }
    };
    if (mode === "spectate") ch.postMessage({ type: "request-state" });
    return () => { ch.close(); localCh.current = null; };
  }, [mode, roomId, lastMove, resultMsg]);

  // Online realtime channel — used by both players AND spectators on a roomId
  useEffect(() => {
    if (!roomId || !user) return;
    if (mode !== "online" && mode !== "spectate") return;
    const ch = supabase.channel(`game-${roomId}`, { config: { presence: { key: user.id } } });
    rtCh.current = ch;

    ch.on("broadcast", { event: "msg" }, ({ payload }) => {
      const data = payload as BroadcastPayload;
      if (data.type === "state") {
        try {
          gameRef.current.load(data.fen);
          setFen(data.fen);
          setHistory(gameRef.current.history({ verbose: true }) as Move[]);
          setLastMove(data.lastMove);
          if (data.resultMsg) setResultMsg(data.resultMsg);
        } catch {/*ignore*/}
      } else if (data.type === "chat") setChat((c) => [...c, data.msg]);
      else if (data.type === "request-state" && mode === "online") {
        // Re-broadcast current state for late joiners (players + spectators)
        ch.send({
          type: "broadcast", event: "msg",
          payload: { type: "state", fen: gameRef.current.fen(), lastMove, resultMsg },
        });
      }
    });

    if (mode === "online") {
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        const others = Object.keys(state).filter((k) => k !== user.id);
        if (others.length > 0) {
          const oid = others[0];
          setOpponentId(oid);
          supabase.from("profiles").select("username").eq("id", oid).single().then(({ data }) => {
            if (data?.username) setOpponentName(data.username);
          });
          supabase.from("friendships").select("friend_id").eq("user_id", user.id).eq("friend_id", oid).maybeSingle().then(({ data }) => {
            if (data) setAlreadyFriends(true);
          });
        }
      });
    }

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: user.id, role: mode === "spectate" ? "spectator" : "player" });
        ch.send({ type: "broadcast", event: "msg", payload: { type: "request-state" } });
      }
    });

    return () => { supabase.removeChannel(ch); rtCh.current = null; };
  }, [mode, roomId, user?.id]);

  // Register / unregister this game in active_games (so friends can spectate).
  // Only the white player owns the row to avoid races.
  useEffect(() => {
    if (mode !== "online" || !roomId || !user || playerColor !== "w") return;
    let cancelled = false;
    const register = async () => {
      // Wait briefly until opponentId is known so we can store both names
      const start = Date.now();
      while (!cancelled && !opponentId && Date.now() - start < 5000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (cancelled || !opponentId) return;
      const { data: meProf } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      await supabase.from("active_games").upsert({
        room_id: roomId,
        white_user: user.id,
        black_user: opponentId,
        white_username: meProf?.username ?? null,
        black_username: opponentName,
      });
    };
    register();
    return () => {
      cancelled = true;
      supabase.from("active_games").delete().eq("room_id", roomId).then(() => {});
    };
  }, [mode, roomId, user?.id, playerColor, opponentId, opponentName]);

  const tryMove = useCallback((from: Square, to: Square): boolean => {
    try {
      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;
      const lm = { from: move.from as Square, to: move.to as Square };
      setLastMove(lm);
      setDrawOffered(null);
      sync(lm);
      return true;
    } catch { return false; }
  }, [sync]);

  // AI move
  useEffect(() => {
    if (resultMsg || mode !== "ai" || turn === playerColor) return;
    setThinking(true);
    const id = setTimeout(() => {
      const move = findBestMove(gameRef.current.fen(), aiDepth);
      if (move) {
        gameRef.current.move(move);
        const lm = { from: move.from as Square, to: move.to as Square };
        setLastMove(lm);
        sync(lm);
      }
      setThinking(false);
    }, 250);
    return () => { clearTimeout(id); setThinking(false); };
  }, [fen, mode, playerColor, aiDepth, resultMsg, sync, turn]);

  // Save history
  const savedRef = useRef(false);
  useEffect(() => {
    if (!resultMsg || mode === "spectate" || savedRef.current) return;
    savedRef.current = true;
    let result: GameResult = "draw";
    const lower = resultMsg.toLowerCase();
    if (mode === "ai" || mode === "online") {
      if (lower.includes("white wins") || lower.includes("white resigned") === false && lower.includes("black resigned")) {
        // simpler:
      }
      if (lower.includes("white wins")) result = playerColor === "w" ? "win" : "loss";
      else if (lower.includes("black wins")) result = playerColor === "b" ? "win" : "loss";
      else result = "draw";
    } else if (mode === "local") {
      if (lower.includes("white wins") || lower.includes("black wins")) result = "win";
      else result = "draw";
    }
    const opponent = mode === "ai"
      ? `AI (${aiDepth === 2 ? "Easy" : aiDepth === 3 ? "Medium" : "Hard"})`
      : mode === "online" ? opponentName : "Local opponent";
    const modeLabel = mode === "ai" ? "Vs AI" : mode === "online" ? "Online" : "Local 2-Player";
    saveGameHistory({ result, opponent, mode: modeLabel }).catch(() => {});

    // Apply ELO rating update for online matches
    if (mode === "online" && user && opponentId) {
      const whiteId = playerColor === "w" ? user.id : opponentId;
      const blackId = playerColor === "w" ? opponentId : user.id;
      let whiteScore = 0.5;
      if (lower.includes("white wins")) whiteScore = 1;
      else if (lower.includes("black wins")) whiteScore = 0;
      (supabase as any).rpc("apply_match_result", {
        p_white: whiteId, p_black: blackId, p_result: whiteScore,
      }).then(() => {});
      // Clean up active_games row
      if (roomId) supabase.from("active_games").delete().eq("room_id", roomId).then(() => {});
    }
  }, [resultMsg, mode, playerColor, aiDepth, opponentName, opponentId, user?.id, roomId]);

  const isInteractive =
    !resultMsg && mode !== "spectate" &&
    !(mode === "ai" && turn !== playerColor) &&
    !(mode === "online" && turn !== playerColor);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare || !isInteractive) return false;
    return tryMove(sourceSquare as Square, targetSquare as Square);
  }, [isInteractive, tryMove]);

  const onSquareClick = useCallback(({ square }: { square: string }) => {
    if (!isInteractive) return;
    const sq = square as Square;
    if (selected) {
      if (sq === selected) { setSelected(null); setLegalTargets([]); return; }
      if (tryMove(selected, sq)) return;
    }
    const piece = gameRef.current.get(sq);
    if (piece && piece.color === turn) {
      const moves = gameRef.current.moves({ square: sq, verbose: true }) as Move[];
      setSelected(sq);
      setLegalTargets(moves.map((m) => m.to as Square));
    } else { setSelected(null); setLegalTargets([]); }
  }, [isInteractive, selected, tryMove, turn]);

  const announce = (msg: string) => {
    setResultMsg(msg);
    if (mode === "local") broadcastLocal({ type: "state", fen: gameRef.current.fen(), lastMove, resultMsg: msg });
    if (mode === "online") broadcastRT({ type: "state", fen: gameRef.current.fen(), lastMove, resultMsg: msg });
  };

  const resign = () => {
    if (resultMsg) return;
    const loser = mode === "online" ? (playerColor === "w" ? "White" : "Black") : (turn === "w" ? "White" : "Black");
    const winner = loser === "White" ? "Black" : "White";
    announce(`${loser} resigned — ${winner} wins! 🏆`);
  };

  const offerDraw = () => {
    if (resultMsg) return;
    if (mode === "ai") {
      setChat((c) => [...c, { from: "AI", text: "Draw declined. Play on!", ts: Date.now() }]);
      return;
    }
    if (drawOffered && drawOffered !== turn) announce("Draw agreed");
    else {
      setDrawOffered(turn);
      setChat((c) => [...c, { from: turn === "w" ? "White" : "Black", text: "offers a draw 🤝", ts: Date.now() }]);
    }
  };

  const reset = () => {
    gameRef.current = new Chess();
    setLastMove(null);
    setDrawOffered(null);
    setResultMsg(null);
    savedRef.current = false;
    sync(null);
  };

  const sendChat = () => {
    const t = chatInput.trim();
    if (!t) return;
    const baseName = myName || "You";
    const from = mode === "spectate" ? `${baseName} (spectator)` : baseName;
    const msg = { from, text: t, ts: Date.now() };
    setChat((c) => [...c, msg]);
    setChatInput("");
    sfx.chat();
    if (mode === "local") broadcastLocal({ type: "chat", msg });
    else if (mode === "spectate" && !roomId) broadcastLocal({ type: "chat", msg });
    else if (mode === "online" || mode === "spectate") broadcastRT({ type: "chat", msg });
  };

  const sendFriendRequest = async () => {
    if (!user || !opponentId) return;
    const { error } = await supabase.from("friend_requests").insert({
      from_user: user.id, to_user: opponentId, status: "pending",
    });
    if (error) toast.error(error.message);
    else { toast.success("Friend request sent!"); setFriendRequestSent(true); }
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      styles[lastMove.from] = { background: "var(--last-move)" };
      styles[lastMove.to] = { background: "var(--last-move)" };
    }
    if (selected) styles[selected] = { background: "var(--highlight)" };
    for (const t of legalTargets) {
      styles[t] = { background: "radial-gradient(circle, var(--highlight) 28%, transparent 32%)" };
    }
    if (inCheck && !resultMsg) {
      const board = gameRef.current.board();
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p && p.type === "k" && p.color === turn) {
          const sq = (String.fromCharCode(97 + f) + (8 - r));
          styles[sq] = { background: "var(--check)" };
        }
      }
    }
    return styles;
  }, [lastMove, selected, legalTargets, inCheck, turn, fen, resultMsg]);

  const boardOrientation: "white" | "black" =
    mode === "ai" || mode === "online" ? (playerColor === "w" ? "white" : "black") : "white";

  const modeLabel =
    mode === "ai" ? `Vs AI · ${aiDepth === 2 ? "Easy" : aiDepth === 3 ? "Medium" : "Hard"}`
    : mode === "online" ? `Online vs ${opponentName}`
    : mode === "local" ? "Local 2-Player" : "Spectating";

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_360px] items-start">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" /> {modeLabel}</Badge>
          <Button variant="ghost" size="sm" onClick={toggleMusic} className="ml-auto gap-2" title={musicOn ? "Mute music" : "Play music"}>
            {musicOn ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
            {musicOn ? "Music off" : "Music"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onExit} className="gap-2">
            <Home className="h-4 w-4" /> Menu
          </Button>
        </div>


        <div ref={containerRef} className="relative rounded-2xl p-3 sm:p-4 bg-card border border-border" style={{ boxShadow: "var(--shadow-board)" }}>
          <Chessboard
            options={{
              position: fen, onPieceDrop, onSquareClick, boardOrientation,
              boardStyle: { borderRadius: "12px", width: boardWidth, height: boardWidth },
              squareStyles,
              darkSquareStyle: { backgroundColor: "oklch(0.42 0.06 30)" },
              lightSquareStyle: { backgroundColor: "oklch(0.82 0.04 80)" },
              animationDurationInMs: 200,
            }}
          />
          {thinking && !resultMsg && (
            <div className="absolute top-5 right-5 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> AI thinking…
            </div>
          )}
          {resultMsg && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/85 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
              <Card className="p-6 sm:p-8 text-center space-y-4 border-primary/40 shadow-2xl max-w-sm mx-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/20 text-primary">
                  <Trophy className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">Game Over</h2>
                  <p className="text-base text-foreground/90">{resultMsg}</p>
                </div>
                {mode === "online" && opponentId && !alreadyFriends && (
                  <Button onClick={sendFriendRequest} disabled={friendRequestSent} variant="secondary" className="gap-2 w-full">
                    <UserPlus className="h-4 w-4" />
                    {friendRequestSent ? "Friend request sent" : `Add ${opponentName} as friend`}
                  </Button>
                )}
                <div className="flex gap-2 justify-center pt-2">
                  {mode !== "spectate" && mode !== "online" && (
                    <Button onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Rematch</Button>
                  )}
                  <Button variant="secondary" onClick={onExit} className="gap-2"><Home className="h-4 w-4" /> Main Menu</Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        {mode !== "spectate" && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={offerDraw} variant="secondary" className="gap-2" disabled={!!resultMsg}><Handshake className="h-4 w-4" /> Offer Draw</Button>
            <Button onClick={resign} variant="destructive" className="gap-2" disabled={!!resultMsg}><Flag className="h-4 w-4" /> Resign</Button>
            {mode !== "online" && (
              <Button onClick={reset} variant="default" className="gap-2 ml-auto"><RotateCcw className="h-4 w-4" /> {resultMsg ? "Rematch" : "New Game"}</Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /><h3 className="font-semibold">Game Status</h3></div>
            <Badge variant={turn === "w" ? "default" : "secondary"}>{turn === "w" ? "White" : "Black"} to move</Badge>
          </div>
          {resultMsg ? (
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm font-medium text-primary">{resultMsg}</div>
          ) : inCheck ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">Check!</div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {mode === "ai" && `Playing as ${playerColor === "w" ? "White" : "Black"} vs AI`}
              {mode === "local" && "Local 2-player mode (open another tab to spectate)"}
              {mode === "spectate" && "Watching a live local game"}
              {mode === "online" && (turn === playerColor ? "Your turn" : `Waiting for ${opponentName}…`)}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-2 text-sm">Moves</h3>
          <ScrollArea className="h-40 pr-2">
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
              {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                <div key={i} className="contents">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{history[i * 2]?.san ?? ""}</span>
                  <span>{history[i * 2 + 1]?.san ?? ""}</span>
                </div>
              ))}
              {history.length === 0 && <span className="col-span-3 text-muted-foreground text-xs">No moves yet.</span>}
            </div>
          </ScrollArea>
        </Card>

        <Card className="p-4 flex flex-col h-80">
          <h3 className="font-semibold mb-2 text-sm">Chat</h3>
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-2">
              {chat.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className={cn(
                    "font-medium",
                    m.from === "System" ? "text-primary" :
                    m.from === "AI" ? "text-chart-2" :
                    m.from.includes("(spectator)") ? "text-chart-3" : "text-foreground"
                  )}>{m.from}:</span>{" "}
                  <span className="text-muted-foreground">{m.text}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder="Say something…"
            />
            <Button size="icon" onClick={sendChat}><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
