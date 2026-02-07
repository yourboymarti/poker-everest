"use client";

import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

import { RoomState } from "@/types/room";
import { TaskSidebar, RoomHeader, PokerTable, VotingCards, ConsensusConfetti } from "./poker";

let socket: Socket;

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

export default function PokerRoom({ roomId: initialRoomId, userName, avatar }: { roomId: string; userName: string; avatar: string }) {
    const getRoomHostKey = (targetRoomId: string): string | null => {
        if (typeof window === "undefined") return null;
        return localStorage.getItem(`room_host_key_${targetRoomId}`);
    };

    const [roomId, setRoomId] = useState(initialRoomId);
    const [state, setState] = useState<RoomState | null>(null);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [newTaskName, setNewTaskName] = useState("");

    const [isSidebarOpen, setSidebarOpen] = useState(
        typeof window === "undefined" ? true : window.innerWidth >= 768,
    );
    const [hasAttemptedRestore, setHasAttemptedRestore] = useState(false);
    const [lastDeletedTask, setLastDeletedTask] = useState<DeletedTask | null>(null);
    const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [myId, setMyId] = useState<string | null>(null);

    useEffect(() => {
        socket = io();

        socket.on("connect", () => {
            setIsConnected(true);
            setMyId(socket.id || null);
            setError(null);
            const hostKey = getRoomHostKey(roomId);
            socket.emit("join_room_v2", { roomId, userName, avatar, hostKey });
        });

        socket.on("room_state", (newState: RoomState) => {
            setState(newState);
            if (newState.status === "voting" && newState.votes && socket.id && !newState.votes[socket.id]) {
                setMyVote(null);
            }
        });

        socket.on("room_migrated", ({ newRoomId }) => {
            const currentHostKey = getRoomHostKey(roomId);
            if (currentHostKey) {
                localStorage.setItem(`room_host_key_${newRoomId}`, currentHostKey);
            }
            setRoomId(newRoomId);
            window.history.replaceState(null, "", `?room=${newRoomId}`);
        });

        socket.on("room_not_found", ({ roomId: unknownRoomId }) => {
            setError(`Комната ${unknownRoomId} не найдена`);
        });

        socket.on("room_full", ({ maxPlayers }) => {
            setError(`Комната заполнена (максимум ${maxPlayers} участников)`);
        });

        return () => {
            socket.disconnect();
            setIsConnected(false);
        };
    }, [roomId, userName, avatar]);

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
        const isAdmin = state?.adminId === socket?.id;
        if (isConnected && state && !hasAttemptedRestore && isAdmin) {
            if (state.tasks.length === 0) {
                const savedTasks = localStorage.getItem(`poker_tasks_${roomId}`);
                if (savedTasks) {
                    try {
                        const tasks = JSON.parse(savedTasks);
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            console.log("Restoring tasks from backup...", tasks.length);
                            socket.emit("restore_tasks", { roomId, tasks });
                        }
                    } catch (e) {
                        console.error("Failed to parse saved tasks", e);
                    }
                }
            }
            setHasAttemptedRestore(true);
        }
    }, [isConnected, state, roomId, hasAttemptedRestore]);

    // Actions
    const castVote = (card: string) => {
        // Allow voting in both "voting" and "revealed" states (for post-reveal discussions)
        if (state?.status === "voting" || state?.status === "revealed") {
            setMyVote(card);
            socket.emit("vote", { roomId, value: card });
        }
    };

    const revealVotes = () => socket.emit("reveal", { roomId });
    const resetRound = () => socket.emit("reset_round", { roomId });
    const endRound = () => socket.emit("end_round", { roomId });

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskName.trim()) {
            socket.emit("add_task", { roomId, taskName: newTaskName });
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

        socket.emit("delete_task", { roomId, taskId });
    };

    const undoDelete = () => {
        if (lastDeletedTask) {
            console.log("Undoing delete for task:", lastDeletedTask.name, lastDeletedTask.id);
            // Restore by sending the task back as a single-item array to restore_tasks
            socket.emit("restore_tasks", { roomId, tasks: [lastDeletedTask] });

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
        socket.emit("start_voting", { roomId, taskId });
    };

    const startTimer = (totalSeconds: number) => {
        socket.emit("update_timer", { roomId, action: "start", seconds: totalSeconds });
    };

    const addTimerMinute = () => {
        socket.emit("update_timer", { roomId, action: "add_minute" });
    };

    const restartTimer = () => {
        socket.emit("update_timer", { roomId, action: "restart" });
    };

    const cancelTimer = () => {
        socket.emit("update_timer", { roomId, action: "cancel" });
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
    if (!isConnected || !state) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-mono animate-pulse">Establishing Comms...</div>;
    }

    // Derived state
    const activeDeck = state.deck || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "?", "☕"];
    const isAdmin = Boolean(myId) && state.adminId === myId;
    const playersList = Object.values(state.players);
    const votedCount = Object.keys(state.votes).length;
    const totalPlayers = playersList.length;
    const currentUser = myId ? state.players[myId] : null;

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
                    onClaimHost={() => socket.emit("claim_host", { roomId, hostKey: getRoomHostKey(roomId) })}
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
                    status={state.status}
                    average={average}
                    isHost={isAdmin}
                    socket={socket}
                    roomId={roomId}
                    onReveal={revealVotes}
                    onReset={resetRound}
                    onEndRound={endRound}
                />

                {/* Footer Controls */}
                <div className="bg-slate-900/90 border-t border-slate-800 p-4 pb-12 md:pb-8 flex flex-col items-center gap-4 z-20 backdrop-blur">

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
