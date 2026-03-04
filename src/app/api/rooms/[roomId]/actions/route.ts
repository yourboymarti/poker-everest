import { NextResponse } from "next/server";
import { performRoomAction } from "server/roomService";
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
        actorId?: string;
        type?: string;
        [key: string]: unknown;
    };

    if (!body.actorId || !body.type) {
        return json({ code: "invalid_action", message: "actorId и type обязательны" }, 400);
    }

    const result = await performRoomAction(roomId, {
        actorId: body.actorId,
        type: body.type,
        taskId: typeof body.taskId === "string" ? body.taskId : undefined,
        taskName: typeof body.taskName === "string" ? body.taskName : undefined,
        tasks: Array.isArray(body.tasks) ? body.tasks : undefined,
        seconds: typeof body.seconds === "number" ? body.seconds : undefined,
        action: typeof body.action === "string" ? body.action : undefined,
        value: typeof body.value === "string" ? body.value : undefined,
        deck: body.deck,
        targetPlayerId: typeof body.targetPlayerId === "string" ? body.targetPlayerId : undefined,
        emoji: typeof body.emoji === "string" ? body.emoji : undefined,
        hostKey: typeof body.hostKey === "string" ? body.hostKey : undefined,
    });

    if ("error" in result) {
        const status =
            result.error === "room_not_found"
                ? 404
                : result.error === "forbidden"
                    ? 403
                    : result.error === "room_full"
                        ? 409
                        : 400;
        return json({ code: result.error, message: result.message, maxPlayers: result.maxPlayers }, status);
    }

    return json(result);
}
