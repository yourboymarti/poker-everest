import { NextResponse } from "next/server";
import { createRoom } from "server/roomService";
import { isPersistentStoreMisconfigured } from "server/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): NextResponse {
    return NextResponse.json(body, {
        status,
        headers: {
            "cache-control": "no-store, max-age=0",
        },
    });
}

export async function POST(request: Request): Promise<NextResponse> {
    if (isPersistentStoreMisconfigured()) {
        return json(
            {
                code: "store_unavailable",
                message: "Для деплоя на Vercel нужен REDIS_URL. In-memory storage в serverless режиме не поддерживается.",
            },
            503,
        );
    }

    const body = (await request.json().catch(() => ({}))) as { gameName?: string };
    const room = await createRoom(body.gameName);
    return json(room, 201);
}
