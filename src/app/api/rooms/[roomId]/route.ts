import { NextRequest, NextResponse } from "next/server";
import { getRoomState } from "server/roomService";
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

export async function GET(
    request: NextRequest,
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
    const playerId = request.nextUrl.searchParams.get("playerId") || undefined;
    const room = await getRoomState(roomId, playerId);

    if (!room) {
        return json({ code: "room_not_found", message: `Комната ${roomId} не найдена` }, 404);
    }

    return json({ room });
}
