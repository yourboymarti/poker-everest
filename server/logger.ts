type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SERVICE_NAME = "poker-everest-server";

function serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    if (typeof error === "string") {
        return { message: error };
    }

    return { message: "Unknown error", raw: error };
}

function write(level: LogLevel, event: string, context: LogContext = {}): void {
    const payload: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        level,
        event,
        service: SERVICE_NAME,
        env: process.env.NODE_ENV || "development",
        pid: process.pid,
        ...context,
    };

    if ("error" in payload) {
        payload.error = serializeError(payload.error);
    }

    const line = JSON.stringify(payload);
    if (level === "error") {
        process.stderr.write(`${line}\n`);
        return;
    }

    process.stdout.write(`${line}\n`);
}

export function logDebug(event: string, context: LogContext = {}): void {
    write("debug", event, context);
}

export function logInfo(event: string, context: LogContext = {}): void {
    write("info", event, context);
}

export function logWarn(event: string, context: LogContext = {}): void {
    write("warn", event, context);
}

export function logError(event: string, context: LogContext = {}): void {
    write("error", event, context);
}

