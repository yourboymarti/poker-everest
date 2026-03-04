import { requestJson } from "@/lib/api";
import { RoomState } from "@/types/room";

type RoomEnvelope = {
    room: RoomState;
    newRoomId?: string;
};

export async function createRoomRequest(gameName: string): Promise<{ roomId: string; hostKey: string }> {
    return requestJson("/api/rooms", {
        method: "POST",
        body: JSON.stringify({ gameName }),
    });
}

export async function joinRoomRequest(
    roomId: string,
    playerId: string,
    userName: string,
    avatar: string,
    hostKey?: string | null,
): Promise<RoomState> {
    const response = await requestJson<RoomEnvelope>(`/api/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify({
            playerId,
            userName,
            avatar,
            hostKey: hostKey || undefined,
        }),
    });

    return response.room;
}

export async function getRoomRequest(roomId: string, playerId?: string | null): Promise<RoomState> {
    const url = playerId ? `/api/rooms/${roomId}?playerId=${encodeURIComponent(playerId)}` : `/api/rooms/${roomId}`;
    const response = await requestJson<RoomEnvelope>(url);
    return response.room;
}

export async function leaveRoomRequest(roomId: string, playerId: string): Promise<void> {
    await requestJson(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        body: JSON.stringify({ playerId }),
    });
}

export async function roomActionRequest(
    roomId: string,
    actorId: string,
    payload: Record<string, unknown>,
): Promise<RoomEnvelope> {
    return requestJson<RoomEnvelope>(`/api/rooms/${roomId}/actions`, {
        method: "POST",
        body: JSON.stringify({
            actorId,
            ...payload,
        }),
    });
}
