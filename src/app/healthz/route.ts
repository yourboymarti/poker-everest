import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
    return NextResponse.json(
        {
            status: "ok",
            version: process.env.npm_package_version || "0.1.0",
            timestamp: new Date().toISOString(),
        },
        {
            headers: {
                "cache-control": "no-store, max-age=0",
            },
        },
    );
}
