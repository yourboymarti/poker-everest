export type ApiErrorPayload = {
    code?: string;
    message?: string;
    maxPlayers?: number;
};

export class ApiError extends Error {
    status: number;
    code?: string;
    maxPlayers?: number;

    constructor(status: number, payload: ApiErrorPayload = {}) {
        super(payload.message || "Request failed");
        this.name = "ApiError";
        this.status = status;
        this.code = payload.code;
        this.maxPlayers = payload.maxPlayers;
    }
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
    }

    const response = await fetch(input, {
        ...init,
        headers,
        cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? ((await response.json()) as ApiErrorPayload & T) : null;

    if (!response.ok) {
        throw new ApiError(response.status, payload || {});
    }

    return payload as T;
}
