import {
  LobbyOnlineUsersSchema,
  type LobbyOnlineUser,
} from "@chessarena/shared";
import { create } from "zustand";

type OutgoingChallenge = {
  toUserId: string;
  toUsername: string;
};

type IncomingChallenge = {
  challengeId: string;
  fromUserId: string;
  fromUsername: string;
};

type LobbyState = {
  onlineUsers: LobbyOnlineUser[];
  outgoing: OutgoingChallenge | null;
  incoming: IncomingChallenge | null;
  setOnlineUsers: (users: LobbyOnlineUser[]) => void;
  setOutgoing: (challenge: OutgoingChallenge | null) => void;
  setIncoming: (challenge: IncomingChallenge | null) => void;
  clearChallenges: () => void;
  clear: () => void;
};

function dedupeUsers(users: LobbyOnlineUser[]): LobbyOnlineUser[] {
  const parsed = LobbyOnlineUsersSchema.safeParse(users);
  const source = parsed.success ? parsed.data : [];
  const byId = new Map<string, LobbyOnlineUser>();
  for (const user of source) {
    byId.set(user.userId, user);
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.username.localeCompare(b.username) || a.userId.localeCompare(b.userId),
  );
}

export const useLobbyStore = create<LobbyState>((set) => ({
  onlineUsers: [],
  outgoing: null,
  incoming: null,
  setOnlineUsers: (users) => set({ onlineUsers: dedupeUsers(users) }),
  setOutgoing: (challenge) => set({ outgoing: challenge }),
  setIncoming: (challenge) => set({ incoming: challenge }),
  clearChallenges: () => set({ outgoing: null, incoming: null }),
  clear: () => set({ onlineUsers: [], outgoing: null, incoming: null }),
}));
