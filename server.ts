import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { initRedis, getRoom, setRoom, deleteRoom, getAllRoomIds, Room, cleanupStaleRooms } from "./server/roomStore";
import { DEFAULT_DECK } from "./shared/deckPresets";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const MAX_PLAYERS = 20;

// Track which room each socket is in (for disconnect handling)
const socketRooms: Record<string, string> = {};

async function main() {
    // Initialize Redis connection
    await initRedis();

    await app.prepare();

    const httpServer = createServer(handler);
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
                    io.to(roomId).emit("room_state", room);
                    console.log(`⏱️ Auto-revealed room ${roomId} due to timer expiration`);
                }
            }
        } catch (error) {
            console.error("Error in timer check interval:", error);
        }
    }, 1000);

    // Cleanup interval for stale in-memory rooms (runs every 1 hour)
    setInterval(() => {
        cleanupStaleRooms();
    }, 60 * 60 * 1000);

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("create_room", async ({ gameName }) => {
            const roomId = Math.random().toString(36).substring(2, 9).toUpperCase();

            const room: Room = {
                status: "starting",
                gameName: gameName || null,
                currentTask: null,
                tasks: [],
                votes: {},
                adminId: socket.id,
                adminUserId: "", // Will be set on first join
                players: {},
                deck: DEFAULT_DECK,
                timerDuration: null,
                votingEndTime: null,
                createdAt: Date.now()
            };

            await setRoom(roomId, room);
            socket.emit("room_created", { roomId });
        });

        socket.on("join_room_v2", async ({ roomId, userName, avatar, isCreator, userId }) => {
            let room = await getRoom(roomId);

            if (!room) {
                room = {
                    status: "starting",
                    gameName: null,
                    currentTask: null,
                    tasks: [],
                    votes: {},
                    adminId: socket.id,
                    adminUserId: userId, // Set initial adminUserId
                    players: {},
                    deck: DEFAULT_DECK,
                    timerDuration: null,
                    votingEndTime: null,
                    createdAt: Date.now()
                };
            }

            // Check player limit
            const currentPlayerCount = Object.keys(room.players).length;
            if (currentPlayerCount >= MAX_PLAYERS && !room.players[socket.id]) {
                socket.emit("room_full", { maxPlayers: MAX_PLAYERS });
                return;
            }

            // Restore Host Identity or Set New
            if (userId && room.adminUserId === userId) {
                // Return of the King
                room.adminId = socket.id;
            } else if (!room.adminId || !room.players[room.adminId]) {
                // Room has no active admin (or admin left), claim if creator or first
                if (isCreator || !room.adminUserId) {
                    room.adminId = socket.id;
                    if (userId) room.adminUserId = userId;
                }
            }

            room.players[socket.id] = {
                id: socket.id,
                userId: userId,
                name: userName,
                avatar,
                isHost: room.adminId === socket.id
            };

            await setRoom(roomId, room);
            socketRooms[socket.id] = roomId;
            socket.join(roomId);
            io.to(roomId).emit("room_state", room);
        });

        socket.on("add_task", async ({ roomId, taskName }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                const newTask = { id: Date.now().toString(), name: taskName, timestamp: Date.now() };
                room.tasks.push(newTask);
                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("restore_tasks", async ({ roomId, tasks }) => {
            console.log(`[RESTORE] Room: ${roomId}, tasks: ${tasks?.length}`);
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                if (!Array.isArray(tasks)) return;
                const restored = tasks.map((t: any) => ({
                    id: t.id || `undo_${Date.now()}`,
                    name: t.name,
                    timestamp: t.timestamp || Date.now(),
                    score: t.score,
                    voteDetails: t.voteDetails
                }));

                // Append unique tasks to the current list
                const existingIds = new Set(room.tasks.map(t => t.id).filter(id => !!id));
                const uniqueNew = restored.filter((t: any) => !existingIds.has(t.id));

                if (uniqueNew.length > 0) {
                    room.tasks = [...room.tasks, ...uniqueNew];
                    await setRoom(roomId, room);
                    io.to(roomId).emit("room_state", room);
                    console.log(`[RESTORE] Added ${uniqueNew.length} tasks. Total count: ${room.tasks.length}`);
                } else {
                    console.log("[RESTORE] No unique tasks identified for restoration.");
                }
            } else {
                console.log(`[RESTORE] Denied. Admin: ${room?.adminId}, Socket: ${socket.id}`);
            }
        });

        socket.on("delete_task", async ({ roomId, taskId }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                const taskToDelete = room.tasks.find(t => t.id === taskId);
                room.tasks = room.tasks.filter(t => t.id !== taskId);

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
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("start_voting", async ({ roomId, taskId, timerSeconds }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                const task = room.tasks.find((t) => t.id === taskId);
                if (task) {
                    room.currentTask = task.name;
                    room.status = "voting";
                    room.votes = {};

                    // Set voting end time
                    if (timerSeconds) {
                        room.timerDuration = timerSeconds;
                        room.votingEndTime = Date.now() + (timerSeconds * 1000);
                    } else {
                        room.timerDuration = null;
                        room.votingEndTime = null;
                    }

                    await setRoom(roomId, room);
                    io.to(roomId).emit("room_state", room);
                }
            }
        });

        socket.on("vote", async ({ roomId, value }) => {
            const room = await getRoom(roomId);
            // Allow voting in both "voting" and "revealed" states (for post-reveal discussions)
            if (room && (room.status === "voting" || room.status === "revealed")) {
                room.votes[socket.id] = value;
                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("reveal", async ({ roomId }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                room.status = "revealed";
                room.votingEndTime = null; // Clear timer
                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("reset_round", async ({ roomId }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                // Save score to current task if revealed
                if (room.status === "revealed" && room.currentTask) {
                    const numericVotes = Object.values(room.votes)
                        .map(v => parseFloat(v))
                        .filter(v => !isNaN(v));

                    // Capture all current players and their votes (or lack thereof)
                    const voteDetails = Object.values(room.players).map(player => ({
                        playerName: player.name,
                        vote: room.votes[player.id] || null
                    }));

                    if (numericVotes.length > 0) {
                        const average = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);

                        // Find and update task
                        const taskIndex = room.tasks.findIndex(t => t.name === room.currentTask);
                        if (taskIndex !== -1) {
                            room.tasks[taskIndex] = {
                                ...room.tasks[taskIndex],
                                score: average,
                                voteDetails: voteDetails
                            };
                            console.log(`✅ [SERVER] Saved voteDetails for task "${room.currentTask}":`, JSON.stringify(voteDetails));
                        }
                    } else {
                        // Handle non-numeric consensus (e.g. all Coffee)
                        const voteValues = Object.values(room.votes);
                        if (voteValues.length > 0 && voteValues.every(v => v === voteValues[0])) {
                            const taskIndex = room.tasks.findIndex(t => t.name === room.currentTask);
                            if (taskIndex !== -1) {
                                room.tasks[taskIndex] = {
                                    ...room.tasks[taskIndex],
                                    score: voteValues[0],
                                    voteDetails: voteDetails
                                };
                                console.log(`✅ [SERVER] Saved consensus voteDetails for task "${room.currentTask}":`, JSON.stringify(voteDetails));
                            }
                        }
                    }
                }

                room.status = "voting";
                room.votes = {};
                await setRoom(roomId, room);

                // Debug log the specific task that was just updated
                const updatedTaskIndex = room.tasks.findIndex(t => t.name === (room.currentTask || ""));
                if (updatedTaskIndex !== -1) {
                    console.log(`📤 [SERVER] Emitting updated task state:`, JSON.stringify(room.tasks[updatedTaskIndex]));
                }

                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("end_round", async ({ roomId }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                // Unlike reset_round, we don't save stats again because they should have been saved 
                // when revealing (or we assume the goal is just to clear the table)
                // Actually, typically we save stats on 'reveal' or 'reset'. 
                // The current existing 'reset_round' does the saving. 
                // If the user clicks "End Round", we should arguably perform the same saving as reset 
                // BUT clear the current task so we go to idle state.

                // Let's duplicate the saving logic for safety to ensure results are captured 
                // if they weren't somehow (though usually we capture on reset? No, existing code captures on reset).
                // Wait, existing code captures on RESET. If we END round, we should also capture.

                if (room.status === "revealed" && room.currentTask) {
                    const numericVotes = Object.values(room.votes)
                        .map(v => parseFloat(v))
                        .filter(v => !isNaN(v));

                    // Capture all current players and their votes (or lack thereof)
                    const voteDetails = Object.values(room.players).map(player => ({
                        playerName: player.name,
                        vote: room.votes[player.id] || null
                    }));

                    if (numericVotes.length > 0) {
                        const average = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);

                        // Find and update task
                        const taskIndex = room.tasks.findIndex(t => t.name === room.currentTask);
                        if (taskIndex !== -1) {
                            room.tasks[taskIndex] = {
                                ...room.tasks[taskIndex],
                                score: average,
                                voteDetails: voteDetails
                            };
                        }
                    } else {
                        // Handle non-numeric consensus
                        const voteValues = Object.values(room.votes);
                        if (voteValues.length > 0 && voteValues.every(v => v === voteValues[0])) {
                            const taskIndex = room.tasks.findIndex(t => t.name === room.currentTask);
                            if (taskIndex !== -1) {
                                room.tasks[taskIndex] = {
                                    ...room.tasks[taskIndex],
                                    score: voteValues[0],
                                    voteDetails: voteDetails
                                };
                            }
                        }
                    }
                }

                room.currentTask = null;
                room.status = "starting";
                room.votes = {};
                room.votingEndTime = null;

                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("change_deck", async ({ roomId, deck }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                room.deck = deck;
                room.votes = {}; // Clear votes when deck changes
                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("update_room_code", async ({ roomId }) => {
            const room = await getRoom(roomId);
            const player = room?.players[socket.id];
            if (room && player && room.adminUserId === player.userId) {
                const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
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
            }
        });


        socket.on("send_reaction", ({ roomId, playerId, emoji }) => {
            io.to(roomId).emit("emoji_reaction", { playerId, emoji });
        });

        socket.on("claim_host", async ({ roomId, userId }) => {
            const room = await getRoom(roomId);
            if (room) {
                // If there's an active admin, only allow reclaiming if it's the SAME persistent user
                if (room.adminId && room.players[room.adminId]) {
                    if (room.adminUserId !== userId) {
                        return; // Forbidden
                    }
                }

                room.adminId = socket.id;
                room.adminUserId = userId;

                // Sync isHost flag for all players
                Object.values(room.players).forEach(p => {
                    p.isHost = p.userId === userId;
                });

                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });

        socket.on("disconnect", async () => {
            console.log("Client disconnected:", socket.id);

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
                console.log(`Room ${roomId} deleted (empty)`);
            } else {
                // If admin left, assign new admin
                // If admin left, DO NOT assign new admin automatically
                // The room will wait for the admin to reconnect (with same userId)
                // OR for another player to explicitly "claim_host"
                if (room.adminId === socket.id) {
                    console.log(`Admin ${socket.id} disconnected from room ${roomId}. Waiting for reconnect or claim.`);
                    // We can leave adminId pointing to the dead socket. 
                    // When they reconnect, 'join_room_v2' will update it if userId matches.
                }
                await setRoom(roomId, room);
                io.to(roomId).emit("room_state", room);
            }
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
}

main().catch(console.error);
