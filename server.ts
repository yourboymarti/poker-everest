import { createServer, IncomingMessage, ServerResponse } from "node:http";
import next from "next";
import { Server } from "socket.io";
import * as Sentry from "@sentry/node";
import { initRedis, getRoom, setRoom, deleteRoom, getAllRoomIds, Room, cleanupStaleRooms, getStoreHealth } from "./server/roomStore";
import { logError, logInfo, logWarn } from "./server/logger";
import { DEFAULT_DECK } from "./shared/deckPresets";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
const APP_VERSION = process.env.npm_package_version || "0.1.0";

const MAX_PLAYERS = 20;
const MAX_TIMER_SECONDS = 60 * 60;
const SENTRY_DSN = process.env.SENTRY_DSN;

// Track which room each socket is in (for disconnect handling)
const socketRooms: Record<string, string> = {};

type PublicPlayer = {
    id: string;
    name: string;
    avatar: string;
    isHost: boolean;
};

type PublicRoom = Omit<Room, "adminKey" | "players"> & {
    players: Record<string, PublicPlayer>;
};

type RestoredTask = {
    id?: string;
    name?: string;
    timestamp?: number;
    score?: string;
    voteDetails?: {
        playerName: string;
        vote: string | null;
    }[];
};

type ServerMetrics = {
    startedAtMs: number;
    socketConnectionsTotal: number;
    socketDisconnectionsTotal: number;
    activeSocketConnections: number;
    roomsCreatedTotal: number;
    roomsDeletedTotal: number;
    votesSubmittedTotal: number;
    reactionsSentTotal: number;
    timerAutoRevealsTotal: number;
    timerUpdatesTotal: number;
    hostClaimsTotal: number;
};

const generateRoomId = () => Math.random().toString(36).substring(2, 9).toUpperCase();
const generateHostKey = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const sentryEnabled = Boolean(SENTRY_DSN);

function syncHostFlags(room: Room): void {
    Object.values(room.players).forEach((player) => {
        player.isHost = player.id === room.adminId;
    });
}

function toPublicRoom(room: Room): PublicRoom {
    const players: Record<string, PublicPlayer> = {};

    for (const [socketId, player] of Object.entries(room.players)) {
        players[socketId] = {
            id: player.id,
            name: player.name,
            avatar: player.avatar,
            isHost: player.id === room.adminId,
        };
    }

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
        createdAt: room.createdAt,
    };
}

function emitRoomState(io: Server, roomId: string, room: Room): void {
    io.to(roomId).emit("room_state", toPublicRoom(room));
}

function isRoomMember(room: Room, socketId: string): boolean {
    return Boolean(room.players[socketId]);
}

function isRoomHost(room: Room, socketId: string): boolean {
    return room.adminId === socketId && isRoomMember(room, socketId);
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

function initSentry(): void {
    if (!sentryEnabled) {
        logInfo("sentry.disabled");
        return;
    }

    const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1");
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        release: APP_VERSION,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    });

    logInfo("sentry.initialized", {
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    });
}

function captureServerError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
    logError(event, { ...context, error });

    if (!sentryEnabled) {
        return;
    }

    Sentry.withScope((scope) => {
        scope.setContext("server_context", context);
        scope.setTag("event", event);
        Sentry.captureException(error);
    });
}

function sendJson(res: ServerResponse<IncomingMessage>, statusCode: number, body: unknown): void {
    res.statusCode = statusCode;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
}

function sendMetrics(
    res: ServerResponse<IncomingMessage>,
    metrics: ServerMetrics,
    activeRoomCount: number,
    redisReady: number,
): void {
    const uptimeSeconds = Math.floor((Date.now() - metrics.startedAtMs) / 1000);

    const payload = [
        "# HELP poker_uptime_seconds Process uptime in seconds",
        "# TYPE poker_uptime_seconds gauge",
        `poker_uptime_seconds ${uptimeSeconds}`,
        "# HELP poker_active_socket_connections Current active Socket.IO connections",
        "# TYPE poker_active_socket_connections gauge",
        `poker_active_socket_connections ${metrics.activeSocketConnections}`,
        "# HELP poker_active_rooms Current active rooms (with connected users)",
        "# TYPE poker_active_rooms gauge",
        `poker_active_rooms ${activeRoomCount}`,
        "# HELP poker_socket_connections_total Total accepted Socket.IO connections",
        "# TYPE poker_socket_connections_total counter",
        `poker_socket_connections_total ${metrics.socketConnectionsTotal}`,
        "# HELP poker_socket_disconnections_total Total Socket.IO disconnects",
        "# TYPE poker_socket_disconnections_total counter",
        `poker_socket_disconnections_total ${metrics.socketDisconnectionsTotal}`,
        "# HELP poker_rooms_created_total Total created rooms",
        "# TYPE poker_rooms_created_total counter",
        `poker_rooms_created_total ${metrics.roomsCreatedTotal}`,
        "# HELP poker_rooms_deleted_total Total deleted rooms",
        "# TYPE poker_rooms_deleted_total counter",
        `poker_rooms_deleted_total ${metrics.roomsDeletedTotal}`,
        "# HELP poker_votes_submitted_total Total submitted votes",
        "# TYPE poker_votes_submitted_total counter",
        `poker_votes_submitted_total ${metrics.votesSubmittedTotal}`,
        "# HELP poker_reactions_sent_total Total sent reactions",
        "# TYPE poker_reactions_sent_total counter",
        `poker_reactions_sent_total ${metrics.reactionsSentTotal}`,
        "# HELP poker_timer_auto_reveals_total Total auto-revealed rounds by timer",
        "# TYPE poker_timer_auto_reveals_total counter",
        `poker_timer_auto_reveals_total ${metrics.timerAutoRevealsTotal}`,
        "# HELP poker_timer_updates_total Total timer update commands",
        "# TYPE poker_timer_updates_total counter",
        `poker_timer_updates_total ${metrics.timerUpdatesTotal}`,
        "# HELP poker_host_claims_total Total host reclaim operations",
        "# TYPE poker_host_claims_total counter",
        `poker_host_claims_total ${metrics.hostClaimsTotal}`,
        "# HELP poker_redis_ready Redis readiness status (1=ready, 0=not ready)",
        "# TYPE poker_redis_ready gauge",
        `poker_redis_ready ${redisReady}`,
        "",
    ].join("\n");

    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
    res.end(payload);
}

async function main() {
    initSentry();

    process.on("uncaughtException", async (error) => {
        captureServerError("process.uncaught_exception", error);
        if (sentryEnabled) {
            await Sentry.flush(2000);
        }
        process.exit(1);
    });

    process.on("unhandledRejection", (reason) => {
        captureServerError("process.unhandled_rejection", reason);
    });

    // Initialize Redis connection
    await initRedis();

    await app.prepare();

    const metrics: ServerMetrics = {
        startedAtMs: Date.now(),
        socketConnectionsTotal: 0,
        socketDisconnectionsTotal: 0,
        activeSocketConnections: 0,
        roomsCreatedTotal: 0,
        roomsDeletedTotal: 0,
        votesSubmittedTotal: 0,
        reactionsSentTotal: 0,
        timerAutoRevealsTotal: 0,
        timerUpdatesTotal: 0,
        hostClaimsTotal: 0,
    };

    const httpServer = createServer(async (req, res) => {
        try {
            const path = (req.url || "/").split("?")[0];

            if (req.method === "GET" && path === "/healthz") {
                sendJson(res, 200, {
                    status: "ok",
                    version: APP_VERSION,
                    uptimeSeconds: Math.floor((Date.now() - metrics.startedAtMs) / 1000),
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            if (req.method === "GET" && path === "/readyz") {
                const storeHealth = await getStoreHealth();
                const ready = storeHealth.mode === "memory" || storeHealth.redisConnected;
                sendJson(res, ready ? 200 : 503, {
                    status: ready ? "ready" : "not_ready",
                    degraded: process.env.NODE_ENV === "production" && storeHealth.mode === "memory",
                    store: storeHealth,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            if (req.method === "GET" && path === "/metrics") {
                const storeHealth = await getStoreHealth();
                const activeRoomCount = new Set(Object.values(socketRooms)).size;
                const redisReady = storeHealth.mode === "memory" || storeHealth.redisConnected ? 1 : 0;
                sendMetrics(res, metrics, activeRoomCount, redisReady);
                return;
            }

            handler(req, res);
        } catch (error) {
            captureServerError("http.request_failed", error, { method: req.method, url: req.url });
            sendJson(res, 500, { status: "error" });
        }
    });
    const io = new Server(httpServer);

    // Global timer check interval (runs every 1 second)
    setInterval(async () => {
        try {
            const roomIds = await getAllRoomIds();
            const now = Date.now();

            for (const roomId of roomIds) {
                const room = await getRoom(roomId);
                if (room && room.status === "voting" && room.votingEndTime && room.votingEndTime <= now) {
                    // Timer expired!
                    room.status = "revealed";
                    room.votingEndTime = null;
                    await setRoom(roomId, room);
                    metrics.timerAutoRevealsTotal += 1;
                    emitRoomState(io, roomId, room);
                    logInfo("timer.auto_reveal", { roomId });
                }
            }
        } catch (error) {
            captureServerError("timer.interval_failed", error);
        }
    }, 1000);

    // Cleanup interval for stale in-memory rooms (runs every 1 hour)
    setInterval(() => {
        cleanupStaleRooms();
    }, 60 * 60 * 1000);

    io.on("connection", (socket) => {
        logInfo("socket.connected", { socketId: socket.id });
        metrics.socketConnectionsTotal += 1;
        metrics.activeSocketConnections += 1;

        socket.on("create_room", async ({ gameName }) => {
            const roomId = generateRoomId();
            const hostKey = generateHostKey();

            const room: Room = {
                status: "starting",
                gameName: typeof gameName === "string" && gameName.trim() ? gameName.trim() : null,
                currentTask: null,
                tasks: [],
                votes: {},
                adminId: socket.id,
                adminKey: hostKey,
                players: {},
                deck: DEFAULT_DECK,
                timerDuration: null,
                votingEndTime: null,
                createdAt: Date.now()
            };

            await setRoom(roomId, room);
            metrics.roomsCreatedTotal += 1;
            socket.emit("room_created", { roomId, hostKey });
        });

        socket.on("join_room_v2", async ({ roomId, userName, avatar, hostKey }) => {
            const room = await getRoom(roomId);
            if (!room) {
                socket.emit("room_not_found", { roomId });
                return;
            }

            // Check player limit
            const currentPlayerCount = Object.keys(room.players).length;
            if (currentPlayerCount >= MAX_PLAYERS && !room.players[socket.id]) {
                socket.emit("room_full", { maxPlayers: MAX_PLAYERS });
                return;
            }

            // Recover host privileges only with the room-scoped host key
            if (typeof hostKey === "string" && hostKey === room.adminKey) {
                room.adminId = socket.id;
            }

            room.players[socket.id] = {
                id: socket.id,
                name: typeof userName === "string" && userName.trim() ? userName.trim().slice(0, 60) : "Anonymous",
                avatar: typeof avatar === "string" && avatar.trim() ? avatar.trim().slice(0, 16) : "🧗",
                isHost: false,
            };
            syncHostFlags(room);

            await setRoom(roomId, room);
            socketRooms[socket.id] = roomId;
            socket.join(roomId);
            emitRoomState(io, roomId, room);
        });

        socket.on("add_task", async ({ roomId, taskName }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id) && typeof taskName === "string" && taskName.trim()) {
                const newTask = { id: Date.now().toString(), name: taskName.trim(), timestamp: Date.now() };
                room.tasks.push(newTask);
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("restore_tasks", async ({ roomId, tasks }) => {
            logInfo("tasks.restore_requested", { roomId, tasksCount: tasks?.length });
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id)) {
                if (!Array.isArray(tasks)) return;
                const restored = tasks
                    .filter((task): task is RestoredTask => typeof task === "object" && task !== null)
                    .filter((task) => typeof task.name === "string" && task.name.trim().length > 0)
                    .map((task) => ({
                        id: typeof task.id === "string" && task.id.trim() ? task.id.trim() : `undo_${Date.now()}`,
                        name: task.name!.trim(),
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

                // Append unique tasks to the current list
                const existingIds = new Set(room.tasks.map((task) => task.id).filter((id) => Boolean(id)));
                const uniqueNew = restored.filter((task) => !existingIds.has(task.id));

                if (uniqueNew.length > 0) {
                    room.tasks = [...room.tasks, ...uniqueNew];
                    await setRoom(roomId, room);
                    emitRoomState(io, roomId, room);
                    logInfo("tasks.restored", { roomId, addedCount: uniqueNew.length, totalTasks: room.tasks.length });
                } else {
                    logInfo("tasks.restore_noop", { roomId });
                }
            } else {
                logWarn("tasks.restore_denied", { roomId, adminId: room?.adminId, socketId: socket.id });
            }
        });

        socket.on("delete_task", async ({ roomId, taskId }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id) && typeof taskId === "string") {
                const taskToDelete = room.tasks.find((task) => task.id === taskId);
                room.tasks = room.tasks.filter((task) => task.id !== taskId);

                // If we deleted the current task (match by Name)
                if (taskToDelete && room.currentTask === taskToDelete.name) {
                    room.currentTask = null;
                    room.status = room.tasks.length === 0 ? "starting" : "voting";
                    room.votes = {};
                }

                // Safety check: if no tasks left, force starting status
                if (room.tasks.length === 0) {
                    room.currentTask = null;
                    room.status = "starting";
                    room.votes = {};
                    room.votingEndTime = null;
                }

                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("start_voting", async ({ roomId, taskId, timerSeconds }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id) && typeof taskId === "string") {
                const task = room.tasks.find((t) => t.id === taskId);
                if (task) {
                    room.currentTask = task.name;
                    room.status = "voting";
                    room.votes = {};

                    // Set voting end time
                    if (typeof timerSeconds === "number" && timerSeconds > 0) {
                        const clampedTimer = Math.min(MAX_TIMER_SECONDS, Math.floor(timerSeconds));
                        room.timerDuration = clampedTimer;
                        room.votingEndTime = Date.now() + clampedTimer * 1000;
                    } else {
                        room.timerDuration = null;
                        room.votingEndTime = null;
                    }

                    await setRoom(roomId, room);
                    emitRoomState(io, roomId, room);
                }
            }
        });

        socket.on("update_timer", async ({ roomId, action, seconds }) => {
            const room = await getRoom(roomId);
            if (!room || !isRoomHost(room, socket.id) || room.status !== "voting") {
                return;
            }

            const now = Date.now();
            switch (action) {
                case "start": {
                    if (typeof seconds !== "number" || seconds <= 0) return;
                    const clampedTimer = Math.min(MAX_TIMER_SECONDS, Math.floor(seconds));
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
                    if (!room.timerDuration || room.timerDuration <= 0) return;
                    room.votingEndTime = now + room.timerDuration * 1000;
                    break;
                }
                case "cancel": {
                    room.timerDuration = null;
                    room.votingEndTime = null;
                    break;
                }
                default:
                    return;
            }

            metrics.timerUpdatesTotal += 1;
            await setRoom(roomId, room);
            emitRoomState(io, roomId, room);
        });

        socket.on("vote", async ({ roomId, value }) => {
            const room = await getRoom(roomId);
            // Allow voting in both "voting" and "revealed" states (for post-reveal discussions)
            if (
                room &&
                isRoomMember(room, socket.id) &&
                typeof value === "string" &&
                (room.status === "voting" || room.status === "revealed")
            ) {
                room.votes[socket.id] = value;
                metrics.votesSubmittedTotal += 1;
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("reveal", async ({ roomId }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id)) {
                room.status = "revealed";
                room.votingEndTime = null; // Clear timer
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("reset_round", async ({ roomId }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id)) {
                saveRoundResults(room);

                room.status = "voting";
                room.votes = {};
                await setRoom(roomId, room);

                // Debug log the specific task that was just updated
                const updatedTaskIndex = room.tasks.findIndex(t => t.name === (room.currentTask || ""));
                if (updatedTaskIndex !== -1) {
                    logInfo("round.reset_task_updated", {
                        roomId,
                        taskId: room.tasks[updatedTaskIndex].id,
                        taskName: room.tasks[updatedTaskIndex].name,
                    });
                }

                emitRoomState(io, roomId, room);
            }
        });

        socket.on("end_round", async ({ roomId }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id)) {
                saveRoundResults(room);

                room.currentTask = null;
                room.status = "starting";
                room.votes = {};
                room.votingEndTime = null;

                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("change_deck", async ({ roomId, deck }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id) && Array.isArray(deck)) {
                room.deck = deck;
                room.votes = {}; // Clear votes when deck changes
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("update_room_code", async ({ roomId }) => {
            const room = await getRoom(roomId);
            if (room && isRoomHost(room, socket.id)) {
                const newRoomId = generateRoomId();
                await setRoom(newRoomId, room);
                await deleteRoom(roomId);

                // Update socket tracking
                for (const sid in socketRooms) {
                    if (socketRooms[sid] === roomId) {
                        socketRooms[sid] = newRoomId;
                    }
                }

                io.to(roomId).emit("room_migrated", { newRoomId });
                io.in(roomId).socketsJoin(newRoomId);
                io.in(roomId).socketsLeave(roomId);
                emitRoomState(io, newRoomId, room);
            }
        });


        socket.on("send_reaction", ({ roomId, playerId, emoji }) => {
            const senderRoomId = socketRooms[socket.id];
            if (!senderRoomId || senderRoomId !== roomId) return;
            metrics.reactionsSentTotal += 1;
            io.to(roomId).emit("emoji_reaction", { playerId, emoji });
        });

        socket.on("claim_host", async ({ roomId, hostKey }) => {
            const room = await getRoom(roomId);
            if (room && isRoomMember(room, socket.id) && typeof hostKey === "string" && hostKey === room.adminKey) {
                room.adminId = socket.id;
                syncHostFlags(room);

                metrics.hostClaimsTotal += 1;
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });

        socket.on("disconnect", async () => {
            logInfo("socket.disconnected", { socketId: socket.id });
            metrics.socketDisconnectionsTotal += 1;
            metrics.activeSocketConnections = Math.max(0, metrics.activeSocketConnections - 1);

            const roomId = socketRooms[socket.id];
            if (!roomId) return;

            delete socketRooms[socket.id];

            const room = await getRoom(roomId);
            if (!room || !room.players[socket.id]) return;

            // Remove player and their vote
            delete room.players[socket.id];
            delete room.votes[socket.id];

            // If room is empty, delete it
            if (Object.keys(room.players).length === 0) {
                await deleteRoom(roomId);
                metrics.roomsDeletedTotal += 1;
                logInfo("room.deleted_empty", { roomId });
            } else {
                // If admin left, assign new admin
                // If admin left, DO NOT assign new admin automatically
                // The room waits for host-key recovery via reconnect or explicit "claim_host".
                if (room.adminId === socket.id) {
                    logWarn("room.host_disconnected", { roomId, socketId: socket.id });
                    syncHostFlags(room);
                }
                await setRoom(roomId, room);
                emitRoomState(io, roomId, room);
            }
        });
    });

    httpServer
        .once("error", (err) => {
            captureServerError("http.server_error", err);
            process.exit(1);
        })
        .listen(port, () => {
            logInfo("server.started", { host: hostname, port, version: APP_VERSION });
        });
}

main().catch((error) => {
    captureServerError("server.bootstrap_failed", error);
    process.exit(1);
});
