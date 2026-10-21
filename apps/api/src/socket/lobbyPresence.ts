import type { LobbyOnlineUser } from "@chessarena/shared";

type LobbyMember = {
  userId: string;
  username: string;
  rating: number;
  socketIds: Set<string>;
};

const byUserId = new Map<string, LobbyMember>();
const userIdBySocketId = new Map<string, string>();

export function isSocketInLobby(socketId: string): boolean {
  return userIdBySocketId.has(socketId);
}

/** Returns true when this socket was newly tracked. */
export function addLobbySocket(
  userId: string,
  username: string,
  rating: number,
  socketId: string,
): boolean {
  if (userIdBySocketId.get(socketId) === userId) {
    const member = byUserId.get(userId);
    if (member) {
      member.username = username;
      member.rating = rating;
    }
    return false;
  }

  let member = byUserId.get(userId);
  if (!member) {
    member = { userId, username, rating, socketIds: new Set() };
    byUserId.set(userId, member);
  } else {
    member.username = username;
    member.rating = rating;
  }

  member.socketIds.add(socketId);
  userIdBySocketId.set(socketId, userId);
  return true;
}

/** Returns true when the socket was in the lobby. */
export function removeLobbySocket(socketId: string): boolean {
  const userId = userIdBySocketId.get(socketId);
  if (!userId) return false;

  userIdBySocketId.delete(socketId);
  const member = byUserId.get(userId);
  if (!member) return true;

  member.socketIds.delete(socketId);
  if (member.socketIds.size === 0) {
    byUserId.delete(userId);
  }
  return true;
}

export function listLobbyUsers(): LobbyOnlineUser[] {
  return [...byUserId.values()]
    .map(({ userId, username, rating }) => ({ userId, username, rating }))
    .sort(
      (a, b) =>
        a.username.localeCompare(b.username) || a.userId.localeCompare(b.userId),
    );
}

export function getLobbyUser(userId: string): {
  userId: string;
  username: string;
  socketIds: string[];
} | null {
  const member = byUserId.get(userId);
  if (!member) return null;
  return {
    userId: member.userId,
    username: member.username,
    socketIds: [...member.socketIds],
  };
}
