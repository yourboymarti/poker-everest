export interface Player {
    id: string;
    name: string;
    avatar: string;
}

export interface Task {
    id: string;
    name: string;
    timestamp: number;
    score?: string;
}

export interface RoomState {
    status: "starting" | "voting" | "revealed";
    currentTask: string;
    tasks: Task[];
    votes: Record<string, string>;
    adminId: string | null;
    players: Record<string, Player>;
    deck?: string[];
    // Timer
    timerDuration?: number | null;
    votingEndTime?: number | null;
}
