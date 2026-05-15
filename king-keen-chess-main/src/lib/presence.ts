import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PRESENCE_CHANNEL = "knight-online-users";

export type PresenceUser = {
  user_id: string;
  username: string;
  rating: number;
  online_at: string;
};

export function useGlobalPresence(self: PresenceUser | null) {
  const [online, setOnline] = useState<Record<string, PresenceUser>>({});

  useEffect(() => {
    if (!self) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: self.user_id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const flat: Record<string, PresenceUser> = {};
        for (const key of Object.keys(state)) {
          const meta = state[key][0];
          if (meta) flat[key] = meta;
        }
        setOnline(flat);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(self);
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [self?.user_id]);

  return online;
}
