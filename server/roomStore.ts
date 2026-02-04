import Redis from "ioredis";

// Room type definition
export interface Room {
    status: "starting" | "voting" | "revealed";
    gameName: string | null;
    currentTask: string | null;
    tasks: {
        id: string;
        name: string;
        timestamp: number;
        score?: string;
        voteDetails?: {
            playerName: string;
            vote: string | null;
        }[];
    }[];
    votes: Record<string, string>;
    adminId: string;
    adminUserId: string; // Persistent user ID for admin recovery
    players: Record<string, { id: string; userId: string; name: string; avatar: string; isHost?: boolean }>;
    deck: string[];
    // Timer
    timerDuration: number | null; // seconds, null = no timer
    votingEndTime: number | null; // timestamp when voting ends
    createdAt: number; // Timestamp when room was created
}

// Try to connect to Redis, fallback to in-memory if not available
let redis: Redis | null = null;
let useInMemory = false;
const inMemoryRooms: Record<string, Room> = {};

const ROOM_PREFIX = "poker:room:";
const ROOM_TTL = 60 * 60 * 24; // 24 hours

export async function initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl && process.env.NODE_ENV === "production") {
        console.warn("⚠️ REDIS_URL not set in production. Defaulting to in-memory storage.");
        useInMemory = true;
        return;
    }

    const urlToUse = redisUrl || "redis://localhost:6379";

    try {
        // Mask credentials for logging
        const maskedUrl = urlToUse.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");
        console.log(`🔌 Attempting to connect to Redis at: ${maskedUrl}`);

        redis = new Redis(urlToUse, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn("⚠️ Redis retry limit reached. Switching to in-memory.");
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 100, 2000);
                console.log(`🔄 Retrying Redis connection attempt ${times} in ${delay}ms...`);
                return delay;
            },
            connectTimeout: 5000, // Increased timeout
        });

        // Prevent unhandled error events from crashing the process
        redis.on("error", (err) => {
            console.warn("⚠️ Redis connection issue:", err.message);
        });

        // Test connection
        await redis.ping();
        console.log("✅ Redis connected successfully");
    } catch (error) {
        console.log("⚠️ Redis not available, using in-memory storage");
        useInMemory = true;
        redis = null;
    }
}

/**
 * Clean up in-memory rooms that are older than the TTL.
 * This is only relevant when running in in-memory mode (fallback).
 */
export function cleanupStaleRooms(): void {
    if (!useInMemory) return;

    const now = Date.now();
    const ttlMs = ROOM_TTL * 1000;
    let deletedCount = 0;

    for (const roomId in inMemoryRooms) {
        const room = inMemoryRooms[roomId];
        // If room is older than TTL, delete it
        if (room.createdAt && (now - room.createdAt > ttlMs)) {
            delete inMemoryRooms[roomId];
            deletedCount++;
        }
    }

    if (deletedCount > 0) {
        console.log(`🧹 [InMemory Cleanup] Removed ${deletedCount} stale rooms.`);
    }
}

export async function getRoom(roomId: string): Promise<Room | null> {
    if (useInMemory) {
        return inMemoryRooms[roomId] || null;
    }

    try {
        const data = await redis?.get(ROOM_PREFIX + roomId);
        return data ? JSON.parse(data) : null;
    } catch {
        return inMemoryRooms[roomId] || null;
    }
}

export async function setRoom(roomId: string, room: Room): Promise<void> {
    if (useInMemory) {
        inMemoryRooms[roomId] = room;
        return;
    }

    try {
        await redis?.setex(ROOM_PREFIX + roomId, ROOM_TTL, JSON.stringify(room));
    } catch {
        inMemoryRooms[roomId] = room;
    }
}

export async function deleteRoom(roomId: string): Promise<void> {
    if (useInMemory) {
        delete inMemoryRooms[roomId];
        return;
    }

    try {
        await redis?.del(ROOM_PREFIX + roomId);
    } catch {
        delete inMemoryRooms[roomId];
    }
}

export async function getAllRoomIds(): Promise<string[]> {
    if (useInMemory) {
        return Object.keys(inMemoryRooms);
    }

    try {
        const keys = await redis?.keys(ROOM_PREFIX + "*") || [];
        return keys.map(key => key.replace(ROOM_PREFIX, ""));
    } catch {
        return Object.keys(inMemoryRooms);
    }
}
