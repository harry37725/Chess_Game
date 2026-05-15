import { createFileRoute, Link } from "@tanstack/react-router";
import { ChessGame } from "@/components/ChessGame";
import { Crown, LogIn, LogOut, User, History as HistoryIcon, Users, Music, VolumeX, Sparkles, Gamepad2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useState } from "react";
import { startMusic, stopMusic, isMusicOn } from "@/lib/sounds";


const searchSchema = z.object({
  room: z.string().optional(),
  color: z.enum(["w", "b"]).optional(),
  spectate: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Knight — Modern Chess" },
      { name: "description", content: "Play chess online or against AI with friends, presence, and chat." },
    ],
  }),
});

function Index() {
  const { user, signOut } = useAuth();
  const { room, color, spectate } = Route.useSearch();
  const [musicOn, setMusicOn] = useState(isMusicOn());
  const toggleMusic = () => {
    if (musicOn) { stopMusic(); setMusicOn(false); }
    else { startMusic(); setMusicOn(true); }
  };


  return (
    <main className="min-h-screen px-4 py-6 sm:py-10" style={{ background: "var(--gradient-bg)" }}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 sm:mb-10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Knight</h1>
              <p className="text-xs text-muted-foreground">Modern chess, beautifully simple.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleMusic} title={musicOn ? "Mute music" : "Play music"}>
              {musicOn ? <VolumeX className="h-4 w-4 mr-1" /> : <Music className="h-4 w-4 mr-1" />}
              {musicOn ? "Music off" : "Music"}
            </Button>
            {user ? (
              <>
                <Button variant="ghost" size="sm" asChild><Link to="/training"><Sparkles className="h-4 w-4 mr-1" />Train</Link></Button>
                <Button variant="ghost" size="sm" asChild><Link to="/minigames"><Gamepad2 className="h-4 w-4 mr-1" />Mini Games</Link></Button>
                <Button variant="ghost" size="sm" asChild><Link to="/friends"><Users className="h-4 w-4 mr-1" />Friends</Link></Button>
                <Button variant="ghost" size="sm" asChild><Link to="/history"><HistoryIcon className="h-4 w-4 mr-1" />History</Link></Button>
                <Button variant="ghost" size="sm" asChild><Link to="/profile"><User className="h-4 w-4 mr-1" />Profile</Link></Button>
                <Button variant="outline" size="sm" onClick={() => signOut()}><LogOut className="h-4 w-4 mr-1" />Sign out</Button>
              </>
            ) : (
              <Button size="sm" asChild><Link to="/auth"><LogIn className="h-4 w-4 mr-1" />Sign in</Link></Button>
            )}
          </div>
        </header>

        <ChessGame initialRoom={room} initialColor={color} initialSpectate={spectate} />

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Built with chess.js · Minimax AI · {user ? "Your games are auto-saved." : "Sign in to save your game history and play online."}
        </footer>
      </div>
    </main>
  );
}
