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
    voteDetails?: {
        playerName: string;
        vote: string | null; // null if they didn't vote
    }[];
}

export interface RoomState {
    status: "starting" | "voting" | "revealed";
    gameName: string | null;
    currentTask: string;
    tasks: Task[];
    votes: Record<string, string>;
    adminId: string | null;
    adminUserId?: string;
    players: Record<string, Player & { userId: string; isHost?: boolean }>;
    deck?: string[];
    // Timer
    timerDuration?: number | null;
    votingEndTime?: number | null;
}
