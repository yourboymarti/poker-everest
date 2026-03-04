const PLAYER_ID_KEY = "poker_player_id";
const ROOM_SESSION_PREFIX = "poker_room_session_";

export type StoredRoomSession = {
    playerId: string;
    userName: string;
    avatar: string;
    updatedAt: number;
};

function createId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreatePlayerId(): string {
    const existingId = localStorage.getItem(PLAYER_ID_KEY);
    if (existingId) {
        return existingId;
    }

    const nextId = createId();
    localStorage.setItem(PLAYER_ID_KEY, nextId);
    return nextId;
}

export function getRoomHostKey(roomId: string): string | null {
    return localStorage.getItem(`room_host_key_${roomId}`);
}

export function setRoomHostKey(roomId: string, hostKey: string): void {
    localStorage.setItem(`room_host_key_${roomId}`, hostKey);
}

export function getRoomSession(roomId: string): StoredRoomSession | null {
    const raw = localStorage.getItem(`${ROOM_SESSION_PREFIX}${roomId}`);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as StoredRoomSession;
        if (!parsed?.playerId || !parsed?.userName || !parsed?.avatar) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function setRoomSession(roomId: string, session: StoredRoomSession): void {
    localStorage.setItem(`${ROOM_SESSION_PREFIX}${roomId}`, JSON.stringify(session));
    localStorage.setItem(`poker_joined_${roomId}`, "true");
}

export function clearRoomSession(roomId: string): void {
    localStorage.removeItem(`${ROOM_SESSION_PREFIX}${roomId}`);
    localStorage.removeItem(`poker_joined_${roomId}`);
}
