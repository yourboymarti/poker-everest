"use client";

import { useState } from "react";
import { Player } from "@/types/room";
import { List, MountainSnow, Copy, Check, LogOut, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VotingTimer from "./VotingTimer";

interface RoomHeaderProps {
    gameName: string | null;
    status: "starting" | "voting" | "revealed";
    votedCount: number;
    totalPlayers: number;
    players: Player[];
    currentUser?: Player | null;
    isSidebarOpen: boolean;
    onOpenSidebar: () => void;
    onCopyLink: () => void;
    onClaimHost: () => void;
    isHost: boolean;
}

export default function RoomHeader({
    gameName,
    status,
    votedCount,
    totalPlayers,
    players,
    currentUser,
    isSidebarOpen,
    onOpenSidebar,
    onCopyLink,
    onClaimHost,
    isHost,
}: RoomHeaderProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showCopied, setShowCopied] = useState(false);

    const handleCopyLink = () => {
        onCopyLink();
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    const handleLogout = () => {
        // Clear persistence
        localStorage.removeItem("poker_player_name");
        localStorage.removeItem("poker_player_avatar");
        // We also need to remove the joined flag for this room
        const params = new URLSearchParams(window.location.search);
        const roomId = params.get("room");
        if (roomId) {
            localStorage.removeItem(`poker_joined_${roomId}`);
        }

        // Reload page to return to entry screen
        window.location.reload();
    };

    return (
        <header className="h-16 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 z-40 relative">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                {!isSidebarOpen && (
                    <button onClick={onOpenSidebar} className="hidden md:block text-slate-400 hover:text-white flex-shrink-0">
                        <List size={20} />
                    </button>
                )}
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2 truncate max-w-[180px] sm:max-w-[300px] md:max-w-none">
                    <MountainSnow size={20} className="text-cyan-400 flex-shrink-0 md:w-6 md:h-6" />
                    <span className="truncate">{gameName || "Poker Everest"}</span>
                </h1>
                {status === "voting" && (
                    <div className="flex items-center gap-2 hidden sm:flex">
                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
                            VOTING ACTIVE
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${votedCount === totalPlayers ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                            {votedCount}/{totalPlayers} voted
                        </span>
                    </div>
                )}
                {status === "revealed" && (
                    <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hidden sm:inline-block">
                        RESULTS
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* Timer */}
                <VotingTimer isHost={isHost} />

                {/* Desktop: Room link button */}
                <button
                    onClick={handleCopyLink}
                    className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${showCopied
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white'
                        }`}
                >
                    {showCopied ? (
                        <>
                            <Check size={16} />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Link size={16} className="text-cyan-400" />
                            Game's URL
                        </>
                    )}
                </button>

                {/* Mobile: Compact icon button */}
                <div className="sm:hidden relative">
                    <button
                        onClick={handleCopyLink}
                        className={`p-2 rounded-full transition-colors ${showCopied
                            ? 'bg-green-500 text-white'
                            : 'hover:bg-slate-800 text-slate-400'
                            }`}
                        title="Copy Room Link"
                    >
                        {showCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <AnimatePresence>
                        {showCopied && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg whitespace-nowrap shadow-lg"
                            >
                                Скопировано!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="h-6 w-px bg-slate-700 mx-1"></div>

            {currentUser && (
                <div className="relative">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-full transition-colors border border-transparent hover:border-slate-700"
                    >
                        <div className="text-right hidden md:block">
                            <div className="text-xs font-bold text-slate-200">{currentUser.name}</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/10">
                            {currentUser.avatar}
                        </div>
                    </button>

                    <AnimatePresence>
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                                >
                                    <div className="p-3 border-b border-slate-700/50">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Signed in as</div>
                                        <div className="font-medium text-slate-200 truncate">{currentUser.name}</div>
                                    </div>



                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
                                    >
                                        <LogOut size={16} />
                                        Change Name
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </header>
    );
}
