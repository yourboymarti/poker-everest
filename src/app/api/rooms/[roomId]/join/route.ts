import { NextResponse } from "next/server";
import { joinRoom } from "server/roomService";
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

export async function POST(
    request: Request,
    context: { params: Promise<{ roomId: string }> },
): Promise<NextResponse> {
    if (isPersistentStoreMisconfigured()) {
        return json(
            {
                code: "store_unavailable",
                message: "Для деплоя на Vercel нужен REDIS_URL. In-memory storage в serverless режиме не поддерживается.",
            },
            503,
        );
    }

    const { roomId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
        playerId?: string;
        userName?: string;
        avatar?: string;
        hostKey?: string;
    };

    if (!body.playerId) {
        return json({ code: "invalid_action", message: "playerId обязателен" }, 400);
    }

    const result = await joinRoom(roomId, body.playerId, body.userName, body.avatar, body.hostKey);
    if ("error" in result) {
        const status = result.error === "room_not_found" ? 404 : result.error === "room_full" ? 409 : 400;
        return json({ code: result.error, message: result.message, maxPlayers: result.maxPlayers }, status);
    }

    return json(result);
}
