"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { Player } from "@/types/room";

const REACTION_EMOJIS = ["🎯", "🍻", "💩", "❤️"];

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
    receivedReaction?: { emoji: string; id: number } | null;
    onShakeBeer: () => void;
    onSendReaction: (emoji: string) => void;
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
    receivedReaction,
    onShakeBeer,
    onSendReaction,
    onMouseEnter,
    onMouseLeave
}: PlayerAvatarProps) {
    const prevVote = useRef(vote);
    const [isChanged, setIsChanged] = useState(false);
    const [hasChangedMind, setHasChangedMind] = useState(false);
    const [showReactionButtons, setShowReactionButtons] = useState(false);
    const [flyingEmojis, setFlyingEmojis] = useState<{ id: number; emoji: string; side: number; seed: number }[]>([]);

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

    // Show received reaction animation
    useEffect(() => {
        if (receivedReaction) {
            const newEmoji = {
                id: receivedReaction.id, // Use the ID from server/table (unique per click)
                emoji: receivedReaction.emoji,
                side: Math.random() > 0.5 ? -700 : 700, // Start from further away
                seed: Math.random() * 20 - 10 // Random Y offset for variation
            };

            setFlyingEmojis((prev) => [...prev, newEmoji]);

            // Remove after animation completes (5s)
            const timer = setTimeout(() => {
                setFlyingEmojis((prev) => prev.filter(e => e.id !== newEmoji.id));
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [receivedReaction]);

    // Calculate position for beer (towards the center)
    const angle = Math.atan2(position.y, position.x);
    // Distance from avatar center towards table center
    const beerDistance = 55;
    const beerX = -Math.cos(angle) * beerDistance;
    const beerY = -Math.sin(angle) * beerDistance;

    const handleSendReaction = (emoji: string) => {
        onSendReaction(emoji);
        // setShowReactionButtons(false); // Keep open for spamming!
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
            className="absolute flex items-center gap-2 scale-65 sm:scale-75 md:scale-90 group z-10 hover:z-20"
            style={{ marginLeft: 0, marginTop: 0 }}
            onMouseEnter={() => {
                onMouseEnter();
                setShowReactionButtons(true);
            }}
            onMouseLeave={() => {
                onMouseLeave();
                setShowReactionButtons(false);
            }}
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

                {/* Emoji Reaction Buttons */}
                <AnimatePresence>
                    {showReactionButtons && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className="absolute -top-10 left-1/2 transform -translate-x-1/2 flex gap-1 bg-slate-800/90 backdrop-blur-sm rounded-full px-2 py-1 border border-slate-700 shadow-xl z-30"
                        >
                            {REACTION_EMOJIS.map((emoji) => (
                                <motion.button
                                    key={emoji}
                                    whileHover={{ scale: 1.3 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSendReaction(emoji);
                                    }}
                                    className="text-lg hover:bg-slate-700/50 rounded-full w-7 h-7 flex items-center justify-center transition-colors"
                                >
                                    {emoji}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Flying Emoji Animation */}
                <AnimatePresence>
                    {flyingEmojis.map((item) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.5, x: item.side, y: item.seed }}
                            animate={{
                                opacity: [0, 1, 1, 0],
                                scale: [0.5, 1.2, 1, 0.8],
                                x: [item.side, 0, 0, 0],
                                y: [item.seed, -20, -10, 80], // Hit above center (-20), slight bounce (-10), then fall (80)
                                rotate: [0, item.side > 0 ? -180 : 180, item.side > 0 ? -200 : 200, item.side > 0 ? -220 : 220]
                            }}
                            transition={{
                                duration: 5,
                                times: [0, 0.3, 0.5, 1], // Fast throw (0.3s), brief hover/bounce (0.2s), then fall
                                ease: ["circOut", "easeInOut", "circIn"] // Decelerate on hit, float, accelerate down
                            }}
                            className="absolute top-0 left-1/2 -ml-3 text-2xl z-40 pointer-events-none"
                        >
                            {item.emoji}
                        </motion.div>
                    ))}
                </AnimatePresence>

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
                            ? hasChangedMind
                                ? "bg-amber-500 text-white border-amber-400 shadow-amber-500/30 animate-pulse"
                                : "bg-white text-slate-900 border-white"
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
