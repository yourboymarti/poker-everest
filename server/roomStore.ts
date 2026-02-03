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
}

// Try to connect to Redis, fallback to in-memory if not available
let redis: Redis | null = null;
let useInMemory = false;
const inMemoryRooms: Record<string, Room> = {};

const ROOM_PREFIX = "poker:room:";
const ROOM_TTL = 60 * 60 * 24; // 24 hours

export async function initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    try {
        // Mask credentials for logging
        const maskedUrl = redisUrl.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");
        console.log(`🔌 Attempting to connect to Redis at: ${maskedUrl}`);

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            retryStrategy: () => null, // Don't retry on connection failure
            connectTimeout: 3000,
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
