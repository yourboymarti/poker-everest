import { DEFAULT_DECK } from "../shared/deckPresets";
import { pickRandomAvatar } from "../shared/avatars";
import { deleteRoom, getRoom, Room, RoomPlayer, RoomReaction, setRoom } from "./roomStore";
import { logInfo, logWarn } from "./logger";

const MAX_PLAYERS = 20;
const MAX_TIMER_SECONDS = 60 * 60;
const PLAYER_STALE_AFTER_MS = 45_000;
const REACTION_TTL_MS = 8_000;

type PublicPlayer = {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
};

export type PublicRoom = Omit<Room, "adminKey" | "players"> & {
    players: Record<string, PublicPlayer>;
};

export type RoomErrorCode =
    | "room_not_found"
    | "room_full"
    | "forbidden"
    | "invalid_action"
    | "store_unavailable";

export type JoinRoomResult =
    | { room: PublicRoom }
    | { error: RoomErrorCode; message: string; maxPlayers?: number };

export type RoomActionInput = {
    actorId: string;
    type: string;
    taskId?: string;
    taskName?: string;
    tasks?: unknown[];
    seconds?: number;
    action?: string;
    value?: string;
    deck?: unknown;
    targetPlayerId?: string;
    emoji?: string;
    hostKey?: string;
};

export type RoomActionResult =
    | { room: PublicRoom; newRoomId?: string }
    | { error: RoomErrorCode; message: string; maxPlayers?: number };

function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
}

function generateHostKey(): string {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function sanitizeString(value: unknown, fallback: string, maxLength: number): string {
    if (typeof value !== "string") {
        return fallback;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function normalizePlayer(playerId: string, player: Partial<RoomPlayer> | undefined, now: number): RoomPlayer {
    return {
        id: sanitizeString(player?.id, playerId, 80),
        name: sanitizeString(player?.name, "Anonymous", 60),
        avatar: sanitizeString(player?.avatar, "🧗", 16),
        isHost: Boolean(player?.isHost),
        lastSeenAt: typeof player?.lastSeenAt === "number" ? player.lastSeenAt : now,
    };
}

function normalizeReaction(reaction: Partial<RoomReaction> | undefined, now: number): RoomReaction | null {
    const playerId = sanitizeString(reaction?.playerId, "", 80);
    const senderId = sanitizeString(reaction?.senderId, "", 80);
    const emoji = sanitizeString(reaction?.emoji, "", 16);

    if (!playerId || !senderId || !emoji) {
        return null;
    }

    return {
        id: sanitizeString(reaction?.id, `${now}_${Math.random().toString(36).slice(2, 8)}`, 64),
        playerId,
        senderId,
        emoji,
        createdAt: typeof reaction?.createdAt === "number" ? reaction.createdAt : now,
    };
}

function normalizeRoom(room: Room): Room {
    const now = Date.now();
    const players = Object.fromEntries(
        Object.entries(room.players || {}).map(([playerId, player]) => [playerId, normalizePlayer(playerId, player, now)]),
    );
    const reactions = Array.isArray(room.reactions)
        ? room.reactions
            .map((reaction) => normalizeReaction(reaction, now))
            .filter((reaction): reaction is RoomReaction => Boolean(reaction))
        : [];

    return {
        status: room.status === "revealed" || room.status === "voting" ? room.status : "starting",
        gameName: typeof room.gameName === "string" && room.gameName.trim() ? room.gameName.trim() : null,
        currentTask: typeof room.currentTask === "string" && room.currentTask.trim() ? room.currentTask.trim() : null,
        tasks: Array.isArray(room.tasks)
            ? room.tasks
                .filter((task) => typeof task?.name === "string" && task.name.trim())
                .map((task) => ({
                    id: sanitizeString(task.id, `task_${Date.now()}`, 80),
                    name: sanitizeString(task.name, "Untitled", 120),
                    timestamp: typeof task.timestamp === "number" ? task.timestamp : now,
                    score: typeof task.score === "string" ? task.score : undefined,
                    voteDetails: Array.isArray(task.voteDetails)
                        ? task.voteDetails.filter(
                            (detail) =>
                                typeof detail?.playerName === "string" &&
                                (typeof detail.vote === "string" || detail.vote === null),
                        )
                        : undefined,
                }))
            : [],
        votes: room.votes && typeof room.votes === "object" ? room.votes : {},
        adminId: typeof room.adminId === "string" && room.adminId.trim() ? room.adminId : null,
        adminKey: sanitizeString(room.adminKey, generateHostKey(), 256),
        players,
        deck: Array.isArray(room.deck) && room.deck.length > 0 ? room.deck.map((card) => String(card)) : DEFAULT_DECK,
        timerDuration: typeof room.timerDuration === "number" ? room.timerDuration : null,
        votingEndTime: typeof room.votingEndTime === "number" ? room.votingEndTime : null,
        reactions,
        createdAt: typeof room.createdAt === "number" ? room.createdAt : now,
    };
}

function syncHostFlags(room: Room): boolean {
    let changed = false;

    if (room.adminId && !room.players[room.adminId]) {
        room.adminId = null;
        changed = true;
    }

    for (const player of Object.values(room.players)) {
        const shouldBeHost = player.id === room.adminId;
        if (player.isHost !== shouldBeHost) {
            player.isHost = shouldBeHost;
            changed = true;
        }
    }

    return changed;
}

function pruneReactions(room: Room, now: number): boolean {
    const nextReactions = room.reactions.filter((reaction) => now - reaction.createdAt <= REACTION_TTL_MS);
    if (nextReactions.length === room.reactions.length) {
        return false;
    }

    room.reactions = nextReactions;
    return true;
}

function expireVotingTimer(room: Room, now: number): boolean {
    if (room.status === "voting" && room.votingEndTime && room.votingEndTime <= now) {
        room.status = "revealed";
        room.votingEndTime = null;
        return true;
    }

    return false;
}

function cleanupStalePlayers(room: Room, now: number): boolean {
    let changed = false;

    for (const [playerId, player] of Object.entries(room.players)) {
        if (now - player.lastSeenAt > PLAYER_STALE_AFTER_MS) {
            delete room.players[playerId];
            delete room.votes[playerId];
            changed = true;
        }
    }

    if (room.adminId && !room.players[room.adminId]) {
        room.adminId = null;
        changed = true;
    }

    return changed;
}

function refreshRoom(room: Room): boolean {
    const now = Date.now();
    let changed = false;

    changed = pruneReactions(room, now) || changed;
    changed = expireVotingTimer(room, now) || changed;
    changed = cleanupStalePlayers(room, now) || changed;
    changed = syncHostFlags(room) || changed;

    return changed;
}

function toPublicRoom(room: Room): PublicRoom {
    const players = Object.fromEntries(
        Object.entries(room.players).map(([playerId, player]) => [
            playerId,
            {
                id: player.id,
                name: player.name,
                avatar: player.avatar,
                isHost: player.id === room.adminId,
            },
        ]),
    );

    return {
        status: room.status,
        gameName: room.gameName,
        currentTask: room.currentTask,
        tasks: room.tasks,
        votes: room.votes,
        adminId: room.adminId,
        players,
        deck: room.deck,
        timerDuration: room.timerDuration,
        votingEndTime: room.votingEndTime,
        reactions: room.reactions,
        createdAt: room.createdAt,
    };
}

function isRoomMember(room: Room, actorId: string): boolean {
    return Boolean(room.players[actorId]);
}

function isRoomHost(room: Room, actorId: string): boolean {
    return room.adminId === actorId && isRoomMember(room, actorId);
}

function getRoundSummary(room: Room): { score?: string; voteDetails: { playerName: string; vote: string | null }[] } {
    const numericVotes = Object.values(room.votes)
        .map((vote) => parseFloat(vote))
        .filter((vote) => !Number.isNaN(vote));

    const voteDetails = Object.values(room.players).map((player) => ({
        playerName: player.name,
        vote: room.votes[player.id] || null,
    }));

    if (numericVotes.length > 0) {
        const average = (numericVotes.reduce((sum, vote) => sum + vote, 0) / numericVotes.length).toFixed(1);
        return { score: average, voteDetails };
    }

    const voteValues = Object.values(room.votes);
    if (voteValues.length > 0 && voteValues.every((vote) => vote === voteValues[0])) {
        return { score: voteValues[0], voteDetails };
    }

    return { voteDetails };
}

function saveRoundResults(room: Room): void {
    if (room.status !== "revealed" || !room.currentTask) {
        return;
    }

    const taskIndex = room.tasks.findIndex((task) => task.name === room.currentTask);
    if (taskIndex === -1) {
        return;
    }

    const summary = getRoundSummary(room);
    room.tasks[taskIndex] = {
        ...room.tasks[taskIndex],
        score: summary.score,
        voteDetails: summary.voteDetails,
    };
}

async function loadRoom(roomId: string): Promise<Room | null> {
    const room = await getRoom(roomId);
    if (!room) {
        return null;
    }

    const normalizedRoom = normalizeRoom(room);
    if (refreshRoom(normalizedRoom)) {
        await setRoom(roomId, normalizedRoom);
    }

    return normalizedRoom;
}

async function persistRoom(roomId: string, room: Room): Promise<PublicRoom> {
    refreshRoom(room);
    await setRoom(roomId, room);
    return toPublicRoom(room);
}

function pickUniqueAvatarForRoom(room: Room, playerId: string, requestedAvatar: unknown): string {
    if (room.players[playerId]?.avatar) {
        return room.players[playerId].avatar;
    }

    const preferredAvatar = sanitizeString(requestedAvatar, "", 16);
    const usedAvatars = Object.entries(room.players)
        .filter(([existingPlayerId]) => existingPlayerId !== playerId)
        .map(([, player]) => player.avatar);

    if (preferredAvatar && !usedAvatars.includes(preferredAvatar)) {
        return preferredAvatar;
    }

    return pickRandomAvatar(usedAvatars);
}

export async function createRoom(gameName: unknown): Promise<{ roomId: string; hostKey: string }> {
    const roomId = generateRoomId();
    const hostKey = generateHostKey();
    const trimmedGameName = typeof gameName === "string" && gameName.trim() ? gameName.trim().slice(0, 120) : null;

    const room: Room = {
        status: "starting",
        gameName: trimmedGameName,
        currentTask: null,
        tasks: [],
        votes: {},
        adminId: null,
        adminKey: hostKey,
        players: {},
        deck: DEFAULT_DECK,
        timerDuration: null,
        votingEndTime: null,
        reactions: [],
        createdAt: Date.now(),
    };

    await setRoom(roomId, room);
    logInfo("room.created", { roomId });
    return { roomId, hostKey };
}

export async function joinRoom(
    roomId: string,
    playerId: string,
    userName: unknown,
    avatar: unknown,
    hostKey?: unknown,
): Promise<JoinRoomResult> {
    const room = await loadRoom(roomId);
    if (!room) {
        return { error: "room_not_found", message: `Комната ${roomId} не найдена` };
    }

    const isExistingPlayer = Boolean(room.players[playerId]);
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= MAX_PLAYERS && !isExistingPlayer) {
        return {
            error: "room_full",
            message: `Комната заполнена (максимум ${MAX_PLAYERS} участников)`,
            maxPlayers: MAX_PLAYERS,
        };
    }

    if (typeof hostKey === "string" && hostKey === room.adminKey) {
        room.adminId = playerId;
    }

    room.players[playerId] = {
        id: playerId,
        name: sanitizeString(userName, "Anonymous", 60),
        avatar: pickUniqueAvatarForRoom(room, playerId, avatar),
        isHost: false,
        lastSeenAt: Date.now(),
    };

    syncHostFlags(room);
    return { room: await persistRoom(roomId, room) };
}

export async function getRoomState(roomId: string, playerId?: string): Promise<PublicRoom | null> {
    const room = await loadRoom(roomId);
    if (!room) {
        return null;
    }

    if (playerId && room.players[playerId]) {
        room.players[playerId].lastSeenAt = Date.now();
        await setRoom(roomId, room);
    }

    return toPublicRoom(room);
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
    const room = await loadRoom(roomId);
    if (!room || !room.players[playerId]) {
        return;
    }

    delete room.players[playerId];
    delete room.votes[playerId];

    if (room.adminId === playerId) {
        room.adminId = null;
    }

    syncHostFlags(room);

    if (Object.keys(room.players).length === 0) {
        await deleteRoom(roomId);
        logInfo("room.deleted_empty", { roomId });
        return;
    }

    await setRoom(roomId, room);
}

export async function performRoomAction(roomId: string, input: RoomActionInput): Promise<RoomActionResult> {
    const room = await loadRoom(roomId);
    if (!room) {
        return { error: "room_not_found", message: `Комната ${roomId} не найдена` };
    }

    if (room.players[input.actorId]) {
        room.players[input.actorId].lastSeenAt = Date.now();
    }

    switch (input.type) {
        case "add_task": {
            if (!isRoomHost(room, input.actorId) || typeof input.taskName !== "string" || !input.taskName.trim()) {
                return { error: "forbidden", message: "Только хост может добавлять задачи" };
            }

            room.tasks.push({
                id: Date.now().toString(),
                name: input.taskName.trim().slice(0, 120),
                timestamp: Date.now(),
            });
            return { room: await persistRoom(roomId, room) };
        }

        case "restore_tasks": {
            if (!isRoomHost(room, input.actorId)) {
                return { error: "forbidden", message: "Только хост может восстанавливать задачи" };
            }

            if (!Array.isArray(input.tasks)) {
                return { error: "invalid_action", message: "Неверный формат списка задач" };
            }

            const restored = input.tasks
                .filter((task): task is Room["tasks"][number] => typeof task === "object" && task !== null)
                .filter((task) => typeof task.name === "string" && task.name.trim().length > 0)
                .map((task) => ({
                    id: sanitizeString(task.id, `undo_${Date.now()}`, 80),
                    name: sanitizeString(task.name, "Untitled", 120),
                    timestamp: typeof task.timestamp === "number" ? task.timestamp : Date.now(),
                    score: typeof task.score === "string" ? task.score : undefined,
                    voteDetails: Array.isArray(task.voteDetails)
                        ? task.voteDetails.filter(
                            (detail) =>
                                typeof detail?.playerName === "string" &&
                                (typeof detail.vote === "string" || detail.vote === null),
                        )
                        : undefined,
                }));

            const existingIds = new Set(room.tasks.map((task) => task.id));
            const uniqueNewTasks = restored.filter((task) => !existingIds.has(task.id));

            if (uniqueNewTasks.length === 0) {
                return { room: toPublicRoom(room) };
            }

            room.tasks = [...room.tasks, ...uniqueNewTasks];
            return { room: await persistRoom(roomId, room) };
        }

        case "delete_task": {
            if (!isRoomHost(room, input.actorId) || typeof input.taskId !== "string") {
                return { error: "forbidden", message: "Только хост может удалять задачи" };
            }

            const taskToDelete = room.tasks.find((task) => task.id === input.taskId);
            room.tasks = room.tasks.filter((task) => task.id !== input.taskId);

            if (taskToDelete && room.currentTask === taskToDelete.name) {
                room.currentTask = null;
                room.status = room.tasks.length === 0 ? "starting" : "voting";
                room.votes = {};
            }

            if (room.tasks.length === 0) {
                room.currentTask = null;
                room.status = "starting";
                room.votes = {};
                room.votingEndTime = null;
            }

            return { room: await persistRoom(roomId, room) };
        }

        case "start_voting": {
            if (!isRoomHost(room, input.actorId) || typeof input.taskId !== "string") {
                return { error: "forbidden", message: "Только хост может запускать голосование" };
            }

            const task = room.tasks.find((candidate) => candidate.id === input.taskId);
            if (!task) {
                return { error: "invalid_action", message: "Задача не найдена" };
            }

            room.currentTask = task.name;
            room.status = "voting";
            room.votes = {};

            if (typeof input.seconds === "number" && input.seconds > 0) {
                const clampedTimer = Math.min(MAX_TIMER_SECONDS, Math.floor(input.seconds));
                room.timerDuration = clampedTimer;
                room.votingEndTime = Date.now() + clampedTimer * 1000;
            } else {
                room.timerDuration = null;
                room.votingEndTime = null;
            }

            return { room: await persistRoom(roomId, room) };
        }

        case "update_timer": {
            if (!isRoomHost(room, input.actorId) || room.status !== "voting") {
                return { error: "forbidden", message: "Только хост может управлять таймером" };
            }

            const now = Date.now();
            switch (input.action) {
                case "start": {
                    if (typeof input.seconds !== "number" || input.seconds <= 0) {
                        return { error: "invalid_action", message: "Неверная длительность таймера" };
                    }
                    const clampedTimer = Math.min(MAX_TIMER_SECONDS, Math.floor(input.seconds));
                    room.timerDuration = clampedTimer;
                    room.votingEndTime = now + clampedTimer * 1000;
                    break;
                }
                case "add_minute": {
                    if (room.votingEndTime && room.votingEndTime > now) {
                        room.votingEndTime += 60 * 1000;
                        room.timerDuration = Math.ceil((room.votingEndTime - now) / 1000);
                    } else {
                        const nextDuration = Math.min(MAX_TIMER_SECONDS, (room.timerDuration || 0) + 60);
                        room.timerDuration = nextDuration;
                        room.votingEndTime = now + nextDuration * 1000;
                    }
                    break;
                }
                case "restart": {
                    if (!room.timerDuration || room.timerDuration <= 0) {
                        return { error: "invalid_action", message: "Сначала запустите таймер" };
                    }
                    room.votingEndTime = now + room.timerDuration * 1000;
                    break;
                }
                case "cancel": {
                    room.timerDuration = null;
                    room.votingEndTime = null;
                    break;
                }
                default:
                    return { error: "invalid_action", message: "Неизвестное действие таймера" };
            }

            return { room: await persistRoom(roomId, room) };
        }

        case "vote": {
            if (!isRoomMember(room, input.actorId) || typeof input.value !== "string") {
                return { error: "forbidden", message: "Голосовать могут только участники комнаты" };
            }

            if (room.status !== "voting" && room.status !== "revealed") {
                return { error: "invalid_action", message: "Сейчас голосование недоступно" };
            }

            room.votes[input.actorId] = input.value.trim().slice(0, 16);
            return { room: await persistRoom(roomId, room) };
        }

        case "reveal": {
            if (!isRoomHost(room, input.actorId)) {
                return { error: "forbidden", message: "Только хост может раскрывать карты" };
            }

            room.status = "revealed";
            room.votingEndTime = null;
            return { room: await persistRoom(roomId, room) };
        }

        case "reset_round": {
            if (!isRoomHost(room, input.actorId)) {
                return { error: "forbidden", message: "Только хост может сбрасывать раунд" };
            }

            saveRoundResults(room);
            room.status = "voting";
            room.votes = {};
            return { room: await persistRoom(roomId, room) };
        }

        case "end_round": {
            if (!isRoomHost(room, input.actorId)) {
                return { error: "forbidden", message: "Только хост может завершать раунд" };
            }

            saveRoundResults(room);
            room.currentTask = null;
            room.status = "starting";
            room.votes = {};
            room.votingEndTime = null;
            return { room: await persistRoom(roomId, room) };
        }

        case "change_deck": {
            if (!isRoomHost(room, input.actorId) || !Array.isArray(input.deck)) {
                return { error: "forbidden", message: "Только хост может менять колоду" };
            }

            room.deck = input.deck.map((card) => String(card).slice(0, 16)).filter(Boolean);
            room.votes = {};
            return { room: await persistRoom(roomId, room) };
        }

        case "update_room_code": {
            if (!isRoomHost(room, input.actorId)) {
                return { error: "forbidden", message: "Только хост может обновлять код комнаты" };
            }

            const newRoomId = generateRoomId();
            await setRoom(newRoomId, room);
            await deleteRoom(roomId);
            logInfo("room.code_rotated", { oldRoomId: roomId, newRoomId });
            return { room: toPublicRoom(room), newRoomId };
        }

        case "send_reaction": {
            if (!isRoomMember(room, input.actorId) || typeof input.targetPlayerId !== "string" || !room.players[input.targetPlayerId]) {
                return { error: "forbidden", message: "Реакцию можно отправить только участнику комнаты" };
            }

            const emoji = sanitizeString(input.emoji, "", 16);
            if (!emoji) {
                return { error: "invalid_action", message: "Пустая реакция" };
            }

            room.reactions.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                playerId: input.targetPlayerId,
                senderId: input.actorId,
                emoji,
                createdAt: Date.now(),
            });

            return { room: await persistRoom(roomId, room) };
        }

        case "claim_host": {
            if (!isRoomMember(room, input.actorId) || typeof input.hostKey !== "string" || input.hostKey !== room.adminKey) {
                return { error: "forbidden", message: "Неверный ключ хоста" };
            }

            room.adminId = input.actorId;
            syncHostFlags(room);
            return { room: await persistRoom(roomId, room) };
        }

        default:
            logWarn("room.action_unknown", { roomId, actorId: input.actorId, type: input.type });
            return { error: "invalid_action", message: "Неизвестное действие" };
    }
}
