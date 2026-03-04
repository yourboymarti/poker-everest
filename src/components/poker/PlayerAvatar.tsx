"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock } from "lucide-react";
import { Player, RoomReaction } from "@/types/room";

const REACTION_EMOJIS = ["🎯", "🚀", "💩", "❤️"];

interface PlayerAvatarProps {
    player: Player;
    isAdmin: boolean;
    hasVoted: boolean;
    vote: string | undefined;
    isVoting: boolean;
    isRevealed: boolean;
    position: { x: number; y: number };
    reactions?: RoomReaction[];
    layoutMode?: "absolute" | "grid";
    onSendReaction: (emoji: string) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

function hashValue(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
}

export default function PlayerAvatar({
    player,
    isAdmin,
    hasVoted,
    vote,
    isVoting,
    isRevealed,
    position,
    reactions = [],
    layoutMode = "absolute",
    onSendReaction,
    onMouseEnter,
    onMouseLeave
}: PlayerAvatarProps) {
    const prevVote = useRef(vote);
    const [isChanged, setIsChanged] = useState(false);
    const [hasChangedMind, setHasChangedMind] = useState(false);
    const [showReactionButtons, setShowReactionButtons] = useState(false);
    const [flyingEmojis, setFlyingEmojis] = useState<{
        id: string;
        emoji: string;
        side: number;
        seed: number;
        drift: number;
        arcHeight: number;
        duration: number;
        spin: number;
        launchDistance: number;
        impactScale: number;
    }[]>([]);
    const seenReactionIds = useRef<Set<string>>(new Set());

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

    useEffect(() => {
        const pendingReactions = reactions.filter((reaction) => !seenReactionIds.current.has(reaction.id));
        if (pendingReactions.length === 0) {
            return;
        }

        const timers: number[] = [];

        for (const reaction of pendingReactions) {
            seenReactionIds.current.add(reaction.id);

            const reactionHash = hashValue(`${reaction.senderId}:${reaction.id}`);
            const side = reactionHash % 2 === 0 ? -1 : 1;
            const newEmoji = {
                id: reaction.id,
                emoji: reaction.emoji,
                side,
                seed: (reactionHash % 18) - 9,
                drift: 12 + (reactionHash % 32),
                arcHeight: 24 + (reactionHash % 30),
                duration: 1.9 + ((reactionHash % 7) * 0.08),
                spin: 90 + (reactionHash % 220),
                launchDistance: layoutMode === "grid" ? 110 + (reactionHash % 40) : 170 + (reactionHash % 90),
                impactScale: 0.95 + ((reactionHash % 20) / 100),
            };

            setFlyingEmojis((prev) => [...prev, newEmoji]);

            const timer = window.setTimeout(() => {
                setFlyingEmojis((prev) => prev.filter((emoji) => emoji.id !== newEmoji.id));
            }, newEmoji.duration * 1000 + 500);
            timers.push(timer);
        }

        return () => {
            for (const timer of timers) {
                window.clearTimeout(timer);
            }
        };
    }, [layoutMode, reactions]);


    const handleSendReaction = (emoji: string) => {
        onSendReaction(emoji);
        // setShowReactionButtons(false); // Keep open for spamming!
    };

    const isGrid = layoutMode === "grid";

    return (
        <motion.div
            initial={isGrid ? { opacity: 0, scale: 0.8 } : { opacity: 0, scale: 0.8 }}
            animate={isGrid
                ? { opacity: 1, scale: 1 }
                : { opacity: 1, scale: 1, x: position.x, y: position.y }
            }
            className={isGrid
                ? "flex flex-col items-center gap-2 relative p-2"
                : "absolute flex items-center gap-2 scale-65 sm:scale-75 md:scale-90 group z-10 hover:z-20"
            }
            style={isGrid ? {} : { marginLeft: 0, marginTop: 0 }}
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
                            initial={{
                                opacity: 0,
                                scale: 0.35,
                                x: item.side * item.launchDistance,
                                y: item.seed + 42,
                                rotate: 0,
                            }}
                            animate={{
                                opacity: [0, 1, 1, 0],
                                scale: [0.35, 1.15, item.impactScale, 0.82],
                                x: [item.side * item.launchDistance, item.side * item.drift, 0, item.side * 10],
                                y: [item.seed + 42, item.seed - item.arcHeight, item.seed - 8, 70],
                                rotate: [0, item.side * item.spin * 0.65, item.side * item.spin, item.side * (item.spin + 40)],
                            }}
                            transition={{
                                duration: item.duration,
                                times: [0, 0.45, 0.62, 1],
                                ease: ["circOut", "easeInOut", "circIn"],
                            }}
                            className="absolute top-0 left-1/2 -ml-3 text-2xl z-40 pointer-events-none drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]"
                        >
                            {item.emoji}
                        </motion.div>
                    ))}
                    {flyingEmojis.map((item) => (
                        <motion.div
                            key={`${item.id}-impact`}
                            initial={{ opacity: 0, scale: 0.3, y: -4 }}
                            animate={{
                                opacity: [0, 0, 0.4, 0],
                                scale: [0.3, 0.3, 1.2, 1.8],
                                y: [-4, -4, -10, -16],
                            }}
                            transition={{
                                duration: item.duration,
                                times: [0, 0.48, 0.62, 1],
                                ease: "easeOut",
                            }}
                            className="absolute top-0 left-1/2 -ml-4 h-8 w-8 rounded-full border border-cyan-200/50 bg-cyan-100/10 z-30 pointer-events-none"
                        />
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
                <div className="absolute -bottom-7 min-w-[68px] max-w-[120px] rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-center text-[10px] leading-3 text-white whitespace-normal break-words backdrop-blur-sm shadow-xl pointer-events-none z-20">
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
