export interface Player {
    id: string;
    name: string;
    avatar: string;
    isHost?: boolean;
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
    currentTask: string | null;
    tasks: Task[];
    votes: Record<string, string>;
    adminId: string | null;
    players: Record<string, Player>;
    deck?: string[];
    // Timer
    timerDuration?: number | null;
    votingEndTime?: number | null;
}
