import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { logInfo, logWarn } from "./logger";

export interface RoomPlayer {
    id: string;
    name: string;
    avatar: string;
    isHost?: boolean;
    lastSeenAt: number;
}

export interface RoomReaction {
    id: string;
    playerId: string;
    senderId: string;
    emoji: string;
    createdAt: number;
}

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
    adminId: string | null;
    adminKey: string; // Secret key used to recover host privileges
    players: Record<string, RoomPlayer>;
    deck: string[];
    timerDuration: number | null;
    votingEndTime: number | null;
    reactions: RoomReaction[];
    createdAt: number;
}

let redis: Redis | null = null;
let upstash: UpstashRedis | null = null;
let useInMemory = false;
const inMemoryRooms: Record<string, Room> = {};
let initPromise: Promise<void> | null = null;

const ROOM_PREFIX = "poker:room:";
const ROOM_TTL = 60 * 60 * 24; // 24 hours

export interface StoreHealth {
    mode: "redis" | "memory";
    redisConfigured: boolean;
    redisConnected: boolean;
    fallbackActive: boolean;
}

export function isPersistentStoreRequired(): boolean {
    return Boolean(process.env.VERCEL);
}

export function isPersistentStoreMisconfigured(): boolean {
    if (!isPersistentStoreRequired()) return false;
    const hasIoRedis = Boolean(process.env.REDIS_URL);
    const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    return !hasIoRedis && !hasUpstash;
}

export async function initRedis(): Promise<void> {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const redisUrl = process.env.REDIS_URL;

    // Prefer Upstash HTTP client (serverless-friendly) when env vars are present
    if (upstashUrl && upstashToken) {
        try {
            logInfo("store.upstash_connect_attempt", {});
            upstash = new UpstashRedis({ url: upstashUrl, token: upstashToken });
            // Test connection
            await upstash.ping();
            logInfo("store.upstash_connected");
        } catch {
            logWarn("store.upstash_unavailable", { fallback: "memory" });
            upstash = null;
            useInMemory = true;
        }
        return;
    }

    if (!redisUrl && process.env.NODE_ENV === "production") {
        logWarn("store.redis_url_missing", {
            fallback: "memory",
            nodeEnv: process.env.NODE_ENV,
            vercel: process.env.VERCEL || null,
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
            connectTimeout: 5000,
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

async function ensureStoreReady(): Promise<void> {
    if (redis || upstash || useInMemory) {
        return;
    }

    if (!initPromise) {
        initPromise = initRedis().finally(() => {
            initPromise = null;
        });
    }

    await initPromise;
}

export async function getStoreHealth(): Promise<StoreHealth> {
    await ensureStoreReady();
    const redisConfigured = Boolean(process.env.REDIS_URL) ||
        Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

    if (useInMemory || (!redis && !upstash)) {
        return {
            mode: "memory",
            redisConfigured,
            redisConnected: false,
            fallbackActive: true,
        };
    }

    try {
        if (upstash) {
            await upstash.ping();
        } else {
            await redis!.ping();
        }
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
    await ensureStoreReady();

    if (useInMemory) {
        return inMemoryRooms[roomId] || null;
    }

    try {
        if (upstash) {
            // Upstash returns parsed JSON automatically
            return await upstash.get<Room>(ROOM_PREFIX + roomId);
        }
        const data = await redis?.get(ROOM_PREFIX + roomId);
        return data ? JSON.parse(data) : null;
    } catch {
        return inMemoryRooms[roomId] || null;
    }
}

export async function setRoom(roomId: string, room: Room): Promise<void> {
    await ensureStoreReady();

    if (useInMemory) {
        inMemoryRooms[roomId] = room;
        return;
    }

    try {
        if (upstash) {
            await upstash.set(ROOM_PREFIX + roomId, room, { ex: ROOM_TTL });
        } else {
            await redis?.setex(ROOM_PREFIX + roomId, ROOM_TTL, JSON.stringify(room));
        }
    } catch {
        inMemoryRooms[roomId] = room;
    }
}

export async function deleteRoom(roomId: string): Promise<void> {
    await ensureStoreReady();

    if (useInMemory) {
        delete inMemoryRooms[roomId];
        return;
    }

    try {
        if (upstash) {
            await upstash.del(ROOM_PREFIX + roomId);
        } else {
            await redis?.del(ROOM_PREFIX + roomId);
        }
    } catch {
        delete inMemoryRooms[roomId];
    }
}

export async function getAllRoomIds(): Promise<string[]> {
    await ensureStoreReady();

    if (useInMemory) {
        return Object.keys(inMemoryRooms);
    }

    try {
        if (upstash) {
            const keys = await upstash.keys(ROOM_PREFIX + "*");
            return keys.map((key: string) => key.replace(ROOM_PREFIX, ""));
        }
        const keys = await redis?.keys(ROOM_PREFIX + "*") || [];
        return keys.map(key => key.replace(ROOM_PREFIX, ""));
    } catch {
        return Object.keys(inMemoryRooms);
    }
}
