import Redis from "ioredis";
import { logInfo, logWarn } from "./logger";

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
    adminKey: string; // Secret key used to recover host privileges
    players: Record<string, { id: string; name: string; avatar: string; isHost?: boolean }>;
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

export interface StoreHealth {
    mode: "redis" | "memory";
    redisConfigured: boolean;
    redisConnected: boolean;
    fallbackActive: boolean;
}

export async function initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl && process.env.NODE_ENV === "production") {
        logWarn("store.redis_url_missing", {
            fallback: "memory",
            nodeEnv: process.env.NODE_ENV,
        });
        useInMemory = true;
        return;
    }

    const urlToUse = redisUrl || "redis://localhost:6379";

    try {
        // Mask credentials for logging
        const maskedUrl = urlToUse.replace(/:\/\/[^:]+:[^@]+@/, "://***:***@");
        logInfo("store.redis_connect_attempt", { redisUrl: maskedUrl });

        redis = new Redis(urlToUse, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    logWarn("store.redis_retry_limit_reached", { retries: times, fallback: "memory" });
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 100, 2000);
                logWarn("store.redis_retry", { retries: times, delayMs: delay });
                return delay;
            },
            connectTimeout: 5000, // Increased timeout
        });

        // Prevent unhandled error events from crashing the process
        redis.on("error", (err) => {
            logWarn("store.redis_runtime_error", { error: err });
        });

        // Test connection
        await redis.ping();
        logInfo("store.redis_connected");
    } catch {
        logWarn("store.redis_unavailable", { fallback: "memory" });
        useInMemory = true;
        redis = null;
    }
}

export async function getStoreHealth(): Promise<StoreHealth> {
    const redisConfigured = Boolean(process.env.REDIS_URL);

    if (useInMemory || !redis) {
        return {
            mode: "memory",
            redisConfigured,
            redisConnected: false,
            fallbackActive: true,
        };
    }

    try {
        await redis.ping();
        return {
            mode: "redis",
            redisConfigured,
            redisConnected: true,
            fallbackActive: false,
        };
    } catch {
        return {
            mode: "redis",
            redisConfigured,
            redisConnected: false,
            fallbackActive: false,
        };
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
        logInfo("store.memory_cleanup", { deletedCount });
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
