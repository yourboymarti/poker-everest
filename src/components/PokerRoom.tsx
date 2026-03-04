"use client";

import React, { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import {
    getOrCreatePlayerId,
    getRoomHostKey,
    getRoomSession,
    setRoomHostKey,
    setRoomSession,
} from "@/lib/clientSession";
import { getRoomRequest, joinRoomRequest, roomActionRequest } from "@/lib/roomApi";
import { RoomState } from "@/types/room";
import { TaskSidebar, RoomHeader, PokerTable, VotingCards, ConsensusConfetti } from "./poker";

type DeletedTask = {
    id: string;
    name: string;
    timestamp: number;
    score?: string;
    voteDetails?: {
        playerName: string;
        vote: string | null;
    }[];
};

const POLL_INTERVAL_MS = 1500;

function getErrorMessage(unknownError: unknown, fallback: string): string {
    if (unknownError instanceof ApiError && unknownError.message) {
        return unknownError.message;
    }
    if (unknownError instanceof Error && unknownError.message) {
        return unknownError.message;
    }
    return fallback;
}

export default function PokerRoom({ roomId: initialRoomId, userName, avatar }: { roomId: string; userName: string; avatar: string }) {
    const [roomId, setRoomId] = useState(initialRoomId);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [state, setState] = useState<RoomState | null>(null);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newTaskName, setNewTaskName] = useState("");

    const [isSidebarOpen, setSidebarOpen] = useState(
        typeof window === "undefined" ? true : window.innerWidth >= 768,
    );
    const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
    const [lastDeletedTask, setLastDeletedTask] = useState<DeletedTask | null>(null);
    const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const existingRoomSession = getRoomSession(initialRoomId);
        setPlayerId(existingRoomSession?.playerId || getOrCreatePlayerId());
    }, [initialRoomId]);

    const applyRoomState = useCallback((nextState: RoomState) => {
        setState(nextState);
        setError(null);
        setActionError(null);

        if (playerId && nextState.status === "voting" && !nextState.votes[playerId]) {
            setMyVote(null);
        }
    }, [playerId]);

    const refreshRoom = useCallback(async () => {
        if (!playerId) {
            return;
        }

        try {
            const nextState = await getRoomRequest(roomId, playerId);
            applyRoomState(nextState);
        } catch (unknownError) {
            if (unknownError instanceof ApiError && unknownError.code === "room_not_found") {
                setError(`Комната ${roomId} не найдена`);
                return;
            }

            if (!state) {
                setError(getErrorMessage(unknownError, "Не удалось загрузить комнату"));
                return;
            }

            setActionError(getErrorMessage(unknownError, "Не удалось обновить состояние комнаты"));
        }
    }, [applyRoomState, playerId, roomId, state]);

    const runRoomAction = useCallback(async (payload: Record<string, unknown>) => {
        if (!playerId) {
            return null;
        }

        try {
            const response = await roomActionRequest(roomId, playerId, payload);

            if (response.newRoomId && response.newRoomId !== roomId) {
                const currentHostKey = getRoomHostKey(roomId);
                if (currentHostKey) {
                    setRoomHostKey(response.newRoomId, currentHostKey);
                }
                const existingRoomSession = getRoomSession(roomId);
                if (existingRoomSession) {
                    setRoomSession(response.newRoomId, {
                        ...existingRoomSession,
                        updatedAt: Date.now(),
                    });
                }
                setRoomId(response.newRoomId);
                window.history.replaceState(null, "", `?room=${response.newRoomId}`);
            }

            applyRoomState(response.room);
            return response.room;
        } catch (unknownError) {
            setActionError(getErrorMessage(unknownError, "Не удалось выполнить действие"));
            return null;
        }
    }, [applyRoomState, playerId, roomId]);

    useEffect(() => {
        if (!playerId) {
            return;
        }

        let cancelled = false;

        setIsLoading(true);
        setState(null);
        setMyVote(null);
        setError(null);
        setActionError(null);
        setHasAttemptedRestore(false);

        joinRoomRequest(roomId, playerId, userName, avatar, getRoomHostKey(roomId))
            .then((room) => {
                if (cancelled) {
                    return;
                }

                applyRoomState(room);
            })
            .catch((unknownError) => {
                if (cancelled) {
                    return;
                }

                setError(getErrorMessage(unknownError, "Не удалось присоединиться к комнате"));
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [roomId, userName, avatar, playerId, applyRoomState]);

    useEffect(() => {
        if (!playerId || !state) {
            return;
        }

        const currentUser = state.players[playerId];
        if (!currentUser) {
            return;
        }

        localStorage.setItem("poker_player_name", currentUser.name);
        localStorage.setItem("poker_player_avatar", currentUser.avatar);
        setRoomSession(roomId, {
            playerId,
            userName: currentUser.name,
            avatar: currentUser.avatar,
            updatedAt: Date.now(),
        });
    }, [playerId, roomId, state]);

    useEffect(() => {
        if (!playerId || error) {
            return;
        }

        const timer = window.setInterval(() => {
            void refreshRoom();
        }, POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [playerId, roomId, error, refreshRoom]);

    // Persistence: Save/Clear tasks in localStorage
    useEffect(() => {
        if (state?.tasks) {
            if (state.tasks.length > 0) {
                localStorage.setItem(`poker_tasks_${roomId}`, JSON.stringify(state.tasks));
            } else if (hasAttemptedRestore) {
                // If the list is empty and we've already tried restoring, it means the user intentionally cleared it.
                // We should clear the backup to prevent it from coming back on refresh.
                localStorage.removeItem(`poker_tasks_${roomId}`);
            }
        }
    }, [state?.tasks, roomId, hasAttemptedRestore]);

    // Persistence: Restore tasks if room is empty and user is admin
    useEffect(() => {
        const isAdmin = state?.adminId === playerId;
        if (playerId && state && !hasAttemptedRestore && isAdmin) {
            if (state.tasks.length === 0) {
                const savedTasks = localStorage.getItem(`poker_tasks_${roomId}`);
                if (savedTasks) {
                    try {
                        const tasks = JSON.parse(savedTasks);
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            console.log("Restoring tasks from backup...", tasks.length);
                            void runRoomAction({ type: "restore_tasks", tasks });
                        }
                    } catch (e) {
                        console.error("Failed to parse saved tasks", e);
                    }
                }
            }
            setHasAttemptedRestore(true);
        }
    }, [playerId, state, roomId, hasAttemptedRestore, runRoomAction]);

    // Actions
    const castVote = (card: string) => {
        // Allow voting in both "voting" and "revealed" states (for post-reveal discussions)
        if (state?.status === "voting" || state?.status === "revealed") {
            setMyVote(card);
            void runRoomAction({ type: "vote", value: card });
        }
    };

    const revealVotes = () => void runRoomAction({ type: "reveal" });
    const resetRound = () => void runRoomAction({ type: "reset_round" });
    const endRound = () => void runRoomAction({ type: "end_round" });

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskName.trim()) {
            void runRoomAction({ type: "add_task", taskName: newTaskName });
            setNewTaskName("");
        }
    };

    const deleteTask = (taskId: string) => {
        const taskToDelete = state?.tasks.find(t => t.id === taskId);
        if (taskToDelete) {
            setLastDeletedTask(taskToDelete);

            // Clear previous timeout if any
            if (undoTimeout) clearTimeout(undoTimeout);

            // Set new timeout to clear the undo option
            const timeout = setTimeout(() => {
                setLastDeletedTask(null);
                setUndoTimeout(null);
            }, 5000);
            setUndoTimeout(timeout);
        }

        void runRoomAction({ type: "delete_task", taskId });
    };

    const undoDelete = () => {
        if (lastDeletedTask) {
            console.log("Undoing delete for task:", lastDeletedTask.name, lastDeletedTask.id);
            // Restore by sending the task back as a single-item array to restore_tasks
            void runRoomAction({ type: "restore_tasks", tasks: [lastDeletedTask] });

            // Clear state
            setLastDeletedTask(null);
            if (undoTimeout) {
                clearTimeout(undoTimeout);
                setUndoTimeout(null);
            }
        } else {
            console.log("Undo failed: lastDeletedTask is null");
        }
    };

    const startVoting = (taskId: string) => {
        void runRoomAction({ type: "start_voting", taskId });
    };

    const startTimer = (totalSeconds: number) => {
        void runRoomAction({ type: "update_timer", action: "start", seconds: totalSeconds });
    };

    const addTimerMinute = () => {
        void runRoomAction({ type: "update_timer", action: "add_minute" });
    };

    const restartTimer = () => {
        void runRoomAction({ type: "update_timer", action: "restart" });
    };

    const cancelTimer = () => {
        void runRoomAction({ type: "update_timer", action: "cancel" });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.origin + "?room=" + roomId);
    };

    // Error state
    if (error) return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-mono gap-4">
            <div className="text-red-400 text-xl">⚠️ {error}</div>
            <button
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
                Вернуться на главную
            </button>
        </div>
    );

    // Loading state
    if (isLoading || !state) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-mono animate-pulse">Syncing Room...</div>;
    }

    // Derived state
    const activeDeck = state.deck || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?", "☕"];
    const isAdmin = Boolean(playerId) && state.adminId === playerId;
    const playersList = Object.values(state.players);
    const votedCount = Object.keys(state.votes).length;
    const totalPlayers = playersList.length;
    const currentUser = playerId ? state.players[playerId] : null;

    // Calculate average
    const numericVotes = Object.values(state.votes).map(v => parseFloat(v)).filter(v => !isNaN(v));
    const average = numericVotes.length > 0 ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1) : null;

    // Check for consensus (all votes are the same and at least 2 people voted)
    const voteValues = Object.values(state.votes);
    const hasConsensus = state.status === "revealed" && voteValues.length >= 2 && voteValues.every(v => v === voteValues[0]);
    const consensusValue = hasConsensus ? voteValues[0] : null;

    return (
        <div className="h-screen bg-slate-900 text-slate-200 font-sans overflow-hidden flex relative">
            {/* Consensus Confetti */}
            <ConsensusConfetti trigger={hasConsensus} consensusValue={consensusValue} />

            {/* Sidebar */}
            <TaskSidebar
                tasks={state.tasks}
                currentTask={state.currentTask}
                isAdmin={isAdmin}
                isOpen={isSidebarOpen}
                newTaskName={newTaskName}
                onClose={() => setSidebarOpen(false)}
                onNewTaskChange={setNewTaskName}
                onAddTask={addTask}
                onDeleteTask={deleteTask}
                onStartVoting={startVoting}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
                {/* Header */}
                <RoomHeader
                    gameName={state.gameName}
                    status={state.status}
                    votedCount={votedCount}
                    totalPlayers={totalPlayers}
                    currentUser={currentUser}
                    isSidebarOpen={isSidebarOpen}
                    onOpenSidebar={() => setSidebarOpen(true)}
                    onCopyLink={copyLink}
                    onClaimHost={() => void runRoomAction({ type: "claim_host", hostKey: getRoomHostKey(roomId) })}
                    isHost={isAdmin}
                    timerDuration={state.timerDuration ?? null}
                    votingEndTime={state.votingEndTime ?? null}
                    onStartTimer={startTimer}
                    onAddMinute={addTimerMinute}
                    onRestartTimer={restartTimer}
                    onCancelTimer={cancelTimer}
                />

                {/* Poker Table */}
                <PokerTable
                    players={playersList}
                    adminId={state.adminId}
                    votes={state.votes}
                    reactions={state.reactions}
                    status={state.status}
                    average={average}
                    isHost={isAdmin}
                    onSendReaction={(targetPlayerId, emoji) => void runRoomAction({ type: "send_reaction", targetPlayerId, emoji })}
                    onReveal={revealVotes}
                    onReset={resetRound}
                    onEndRound={endRound}
                />

                {/* Footer Controls */}
                <div className="bg-slate-900/90 border-t border-slate-800 p-4 pb-12 md:pb-8 flex flex-col items-center gap-4 z-20 backdrop-blur">
                    {actionError && (
                        <div className="w-full max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
                            {actionError}
                        </div>
                    )}

                    {/* Voting Cards */}
                    <VotingCards
                        deck={activeDeck}
                        myVote={myVote}
                        isRevealed={state.status === "revealed"}
                        onVote={castVote}
                    />
                </div>
            </div>

            {/* Undo Notification */}
            {lastDeletedTask && (
                <div className="fixed bottom-24 left-6 md:bottom-8 md:left-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-slate-800 border border-indigo-500/50 rounded-xl p-4 shadow-2xl flex items-center gap-4 backdrop-blur-md">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-200">Задача удалена</span>
                            <span className="text-xs text-slate-400 max-w-[150px] truncate">{lastDeletedTask.name}</span>
                        </div>
                        <button
                            onClick={undoDelete}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                        >
                            ОТМЕНИТЬ
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
