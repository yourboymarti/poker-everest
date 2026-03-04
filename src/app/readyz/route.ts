import { NextResponse } from "next/server";
import { getStoreHealth, isPersistentStoreMisconfigured } from "server/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
    const store = await getStoreHealth();
    const misconfigured = isPersistentStoreMisconfigured();
    const ready = !misconfigured && (store.mode === "memory" || store.redisConnected);

    return NextResponse.json(
        {
            status: ready ? "ready" : "not_ready",
            degraded: process.env.NODE_ENV === "production" && store.mode === "memory",
            store,
            timestamp: new Date().toISOString(),
        },
        {
            status: ready ? 200 : 503,
            headers: {
                "cache-control": "no-store, max-age=0",
            },
        },
    );
}
