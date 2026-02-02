"use client";

import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Timer } from "lucide-react";

import { RoomState } from "@/types/room";
import { TaskSidebar, RoomHeader, PokerTable, VotingCards, VotingTimer, ConsensusConfetti } from "./poker";

let socket: Socket;

// Helper to get persistent user ID
const getPersistentUserId = () => {
    if (typeof window === 'undefined') return undefined; // Server-side safety
    let id = localStorage.getItem("poker_user_id");
    if (!id) {
        id = "user_" + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("poker_user_id", id);
    }
    return id;
};

export default function PokerRoom({ roomId: initialRoomId, userName, avatar }: { roomId: string; userName: string; avatar: string }) {
    const [roomId, setRoomId] = useState(initialRoomId);
    const [state, setState] = useState<RoomState | null>(null);
    const [myVote, setMyVote] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [newTaskName, setNewTaskName] = useState("");

    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [myId, setMyId] = useState<string | null>(null);


    useEffect(() => {
        socket = io();

        socket.on("connect", () => {
            setIsConnected(true);
            setMyId(socket.id || null);
            const isCreator = localStorage.getItem(`room_creator_${roomId}`) === 'true';
            const userId = getPersistentUserId();
            socket.emit("join_room_v2", { roomId, userName, avatar, isCreator, userId });
            if (isCreator) {
                localStorage.removeItem(`room_creator_${roomId}`);
            }
        });

        socket.on("room_state", (newState: RoomState) => {
            setState(newState);
            if (newState.status === "voting" && newState.votes && socket.id && !newState.votes[socket.id]) {
                setMyVote(null);
            }
        });

        socket.on("room_migrated", ({ newRoomId }) => {
            setRoomId(newRoomId);
            window.history.replaceState(null, "", `?room=${newRoomId}`);
        });

        socket.on("room_full", ({ maxPlayers }) => {
            setError(`Комната заполнена (максимум ${maxPlayers} участников)`);
        });

        return () => {
            socket.disconnect();
        };
    }, [roomId, userName, avatar]);

    // Actions
    const castVote = (card: string) => {
        if (state?.status === "voting") {
            setMyVote(card);
            socket.emit("vote", { roomId, value: card });
        }
    };

    const revealVotes = () => socket.emit("reveal", { roomId });
    const resetRound = () => socket.emit("reset_round", { roomId });

    const addTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskName.trim()) {
            socket.emit("add_task", { roomId, taskName: newTaskName });
            setNewTaskName("");
        }
    };

    const deleteTask = (taskId: string) => {
        socket.emit("delete_task", { roomId, taskId });
    };

    const startVoting = (taskId: string) => {
        socket.emit("start_voting", { roomId, taskId });
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
    const isAdmin = state.adminId === socket.id;
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
                    players={playersList}
                    currentUser={currentUser}
                    isSidebarOpen={isSidebarOpen}
                    onOpenSidebar={() => setSidebarOpen(true)}
                    onCopyLink={copyLink}
                    onClaimHost={() => socket.emit("claim_host", { roomId, userId: getPersistentUserId() })}
                />

                {/* Timer Display */}
                {state.status === "voting" && state.votingEndTime && (
                    <div className="absolute top-20 right-6 z-30">
                        <VotingTimer votingEndTime={state.votingEndTime} />
                    </div>
                )}

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
                />

                {/* Footer Controls */}
                <div className="bg-slate-900/90 border-t border-slate-800 p-4 pb-8 flex flex-col items-center gap-4 z-20 backdrop-blur">

                    {/* Voting Cards */}
                    <VotingCards
                        deck={activeDeck}
                        myVote={myVote}
                        isRevealed={state.status === "revealed"}
                        onVote={castVote}
                    />
                </div>
            </div>
        </div>
    );
}
