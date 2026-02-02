"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { Player } from "@/types/room";

interface PlayerAvatarProps {
    player: Player;
    isAdmin: boolean;
    hasVoted: boolean;
    vote: string | undefined;
    isVoting: boolean;
    isRevealed: boolean;
    position: { x: number; y: number };
    showInfo: boolean;
    isShaking: boolean;
    onShakeBeer: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

function BeerGlass({ style, isShaking, onShake }: { style?: React.CSSProperties; isShaking: boolean; onShake: () => void }) {
    return (
        <motion.div
            className="absolute text-2xl cursor-pointer z-0 select-none bg-slate-800/20 rounded-full px-1 hover:bg-slate-700/80 transition-colors"
            style={style}
            animate={isShaking ? {
                rotate: [0, 25, -20, 15, -10, 5, 0],
                transition: { duration: 1.5, ease: "easeInOut" }
            } : {}}
            onClick={(e) => {
                e.stopPropagation();
                onShake();
            }}
            whileHover={{ scale: 1.2 }}
        >
            🍺
        </motion.div>
    );
}

export default function PlayerAvatar({
    player,
    isAdmin,
    hasVoted,
    vote,
    isVoting,
    isRevealed,
    position,
    showInfo,
    isShaking,
    onShakeBeer,
    onMouseEnter,
    onMouseLeave
}: PlayerAvatarProps) {
    const prevVote = useRef(vote);
    const [isChanged, setIsChanged] = useState(false);
    const [hasChangedMind, setHasChangedMind] = useState(false);

    useEffect(() => {
        if (!hasVoted) {
            setHasChangedMind(false);
        }
        if (hasVoted && vote !== undefined && prevVote.current !== undefined && prevVote.current !== vote) {
            setIsChanged(true);
            setHasChangedMind(true);
            const timer = setTimeout(() => setIsChanged(false), 400);
            return () => clearTimeout(timer);
        }
        prevVote.current = vote;
    }, [vote, hasVoted]);

    // Calculate position for beer (towards the center)
    const angle = Math.atan2(position.y, position.x);
    // Distance from avatar center towards table center
    const beerDistance = 55;
    const beerX = -Math.cos(angle) * beerDistance;
    const beerY = -Math.sin(angle) * beerDistance;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
            className="absolute flex items-center gap-2 scale-65 sm:scale-75 md:scale-90 group z-10 hover:z-20"
            style={{ marginLeft: 0, marginTop: 0 }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Avatar + Name Column */}
            <div className={`flex flex-col items-center gap-1 relative`}>
                {/* Beer Glass - positioned on table side */}
                <BeerGlass
                    isShaking={isShaking}
                    onShake={onShakeBeer}
                    style={{
                        left: "50%",
                        top: "50%",
                        marginLeft: beerX - 12, // -12 to center the emoji (half width)
                        marginTop: beerY - 12
                    }}
                />

                <div className={`relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full border-2 flex items-center justify-center text-xl sm:text-2xl shadow-lg bg-slate-900 z-10 transition-colors ${hasVoted ? "border-green-500 shadow-green-900/30" : "border-slate-600"}`}>
                    {player.avatar}
                    {isAdmin && (
                        <div className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 bg-yellow-500 text-black text-[8px] md:text-[10px] px-1 rounded font-bold border border-yellow-600">
                            HOST
                        </div>
                    )}
                    {/* Voting status indicator */}
                    {isVoting && (
                        <div className={`absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center ${hasVoted ? 'bg-green-500' : 'bg-slate-600'}`}>
                            {hasVoted ? <Check size={10} className="text-white" /> : <Clock size={10} className="text-slate-400" />}
                        </div>
                    )}
                </div>
                {/* Player Name - Visible if showInfo is true */}
                <div className={`absolute -bottom-6 bg-slate-900/90 px-2 py-0.5 rounded text-[10px] md:text-xs text-white border border-slate-700 whitespace-nowrap backdrop-blur-sm max-w-[100px] truncate text-center transition-opacity duration-200 pointer-events-none z-20 shadow-xl ${showInfo ? 'opacity-100' : 'opacity-0'}`}>
                    {player.name}
                </div>
            </div>

            {/* Card Display - to the side */}
            <AnimatePresence>
                {hasVoted && (
                    <motion.div
                        variants={{
                            hidden: { x: -10, opacity: 0, scale: 0.8 },
                            visible: { x: 0, opacity: 1, scale: 1 },
                            exit: { x: 10, opacity: 0, scale: 0.8 },
                            changed: {
                                x: 0, opacity: 1,
                                scale: [1, 1.2, 1],
                                rotate: [0, -5, 5, 0],
                                transition: { duration: 0.4 }
                            }
                        }}
                        initial="hidden"
                        animate={isChanged ? "changed" : "visible"}
                        exit="exit"
                        className={`w-7 h-10 md:w-9 md:h-12 rounded-md border-2 flex items-center justify-center text-sm md:text-base font-bold shadow-md transition-colors ${isRevealed
                            ? "bg-white text-slate-900 border-white"
                            : hasChangedMind
                                ? "bg-blue-600 border-red-500 shadow-red-500/20"
                                : "bg-blue-600 border-blue-400"
                            }`}
                    >
                        {isRevealed ? vote : (
                            <div className="w-full h-full rounded-md bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-50"></div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
