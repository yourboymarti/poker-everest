"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Player } from "@/types/room";
import PlayerAvatar from "./PlayerAvatar";
import { Socket } from "socket.io-client";

interface PokerTableProps {
    players: Player[];
    adminId: string | null;
    votes: Record<string, string>;
    status: "starting" | "voting" | "revealed";
    average: string | null;
    isHost: boolean;
    socket: Socket | null;
    roomId: string;
    onReveal: () => void;
    onReset: () => void;
}

export default function PokerTable({
    players,
    adminId,
    votes,
    status,
    average,
    isHost,
    socket,
    roomId,
    onReveal,
    onReset
}: PokerTableProps) {
    // Default to mobile size
    const [dimensions, setDimensions] = useState({ radiusX: 190, radiusY: 130 });
    const [isAnyHovered, setIsAnyHovered] = useState(false);
    const [emojiReaction, setEmojiReaction] = useState<{ playerId: string; emoji: string; id: number } | null>(null);

    // Listen for beer shaking events from server
    useEffect(() => {
        if (!socket) return;


        const handleEmojiReaction = ({ playerId, emoji }: { playerId: string; emoji: string }) => {
            setEmojiReaction({ playerId, emoji, id: Date.now() + Math.random() }); // Ensure uniqueness even for simultaneous events
            // We don't verify timeout here, we let PlayerAvatar handle the animation queue
        };

        socket.on("emoji_reaction", handleEmojiReaction);
        return () => {
            socket.off("emoji_reaction", handleEmojiReaction);
        };
    }, [socket]);

    // ... (keep useEffect for dimensions)

    useEffect(() => {
        const updateDimensions = () => {
            if (window.innerWidth >= 1024) { // lg
                setDimensions({ radiusX: 360, radiusY: 180 });
            } else if (window.innerWidth >= 768) { // md
                setDimensions({ radiusX: 300, radiusY: 170 });
            } else if (window.innerWidth >= 640) { // sm
                setDimensions({ radiusX: 220, radiusY: 140 });
            } else { // mobile
                setDimensions({ radiusX: 140, radiusY: 100 });
            }
        };

        // Initial call
        updateDimensions();

        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative p-4 md:p-8 min-h-[500px]">
            {/* Table - responsive sizes */}
            <div className={`relative bg-slate-800/80 rounded-[60px] sm:rounded-[80px] md:rounded-[100px] border-4 md:border-8 border-slate-900 shadow-2xl flex items-center justify-center mb-24 mt-10 transition-all duration-300 shadow-cyan-900/20 
                w-[220px] h-[130px] 
                sm:w-[350px] sm:h-[200px] 
                md:w-[480px] md:h-[240px] 
                lg:w-[600px] lg:h-[280px]`}
            >
                <div className="absolute inset-0 rounded-[56px] sm:rounded-[72px] md:rounded-[92px] border border-white/5 pointer-events-none"></div>

                {/* Center Content */}
                <div className="text-center z-10 px-4 flex flex-col items-center gap-3">
                    {status === "revealed" ? (
                        <div className="flex flex-col items-center">
                            {average && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                                    <span className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
                                        {average}
                                    </span>
                                    <span className="text-xs sm:text-sm text-cyan-400 uppercase tracking-widest font-bold mt-1">
                                        Average
                                    </span>
                                </motion.div>
                            )}

                            {isHost && (
                                <button onClick={onReset} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-full font-bold transition-colors border border-slate-500 shadow-lg">
                                    RESET ROUND
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-3">
                            <div className="text-slate-500 font-medium text-sm sm:text-base h-6">
                                {status === "starting"
                                    ? "Add a task to start..."
                                    : (status === "voting" ? "Pick your card" : "Waiting for round to start")}
                            </div>

                            {isHost && status === "voting" && (
                                <button onClick={onReveal} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full font-bold transition-colors shadow-lg shadow-orange-500/20 animate-pulse">
                                    REVEAL CARDS
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Players around table - responsive radius */}
                {players.map((player, idx) => {
                    const angle = (idx / players.length) * 2 * Math.PI - Math.PI / 2;
                    const x = Math.cos(angle) * dimensions.radiusX;
                    const y = Math.sin(angle) * dimensions.radiusY;

                    return (
                        <PlayerAvatar
                            key={player.id}
                            player={player}
                            isAdmin={player.id === adminId}
                            hasVoted={!!votes?.[player.id]}
                            vote={votes?.[player.id]}
                            isVoting={status === "voting"}
                            isRevealed={status === "revealed"}
                            position={{ x, y }}
                            showInfo={isAnyHovered}
                            receivedReaction={emojiReaction?.playerId === player.id ? emojiReaction : null}
                            onSendReaction={(emoji) => socket?.emit("send_reaction", { roomId, playerId: player.id, emoji })}
                            onMouseEnter={() => setIsAnyHovered(true)}
                            onMouseLeave={() => setIsAnyHovered(false)}
                        />
                    );
                })}
            </div>
        </div>
    );
}
