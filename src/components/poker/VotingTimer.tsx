"use client";

import { useState, useEffect } from "react";
import { Timer, Play, RotateCcw, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VotingTimerProps {
    isHost: boolean;
    status: "starting" | "voting" | "revealed";
    timerDuration: number | null;
    votingEndTime: number | null;
    onStartTimer: (totalSeconds: number) => void;
    onAddMinute: () => void;
    onRestartTimer: () => void;
    onCancelTimer: () => void;
}

export default function VotingTimer({
    isHost,
    status,
    timerDuration,
    votingEndTime,
    onStartTimer,
    onAddMinute,
    onRestartTimer,
    onCancelTimer,
}: VotingTimerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [minutes, setMinutes] = useState(2);
    const [seconds, setSeconds] = useState(0);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (status !== "voting" || !votingEndTime) {
            return;
        }

        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, [status, votingEndTime]);

    useEffect(() => {
        setNow(Date.now());
    }, [status, votingEndTime, timerDuration]);

    const isRunning = status === "voting" && typeof votingEndTime === "number" && votingEndTime > now;
    const timeLeft = isRunning ? Math.max(0, Math.ceil((votingEndTime - now) / 1000)) : 0;
    const totalTime = timerDuration && timerDuration > 0 ? timerDuration : timeLeft;

    const startTimer = () => {
        const total = minutes * 60 + seconds;
        if (total > 0) {
            onStartTimer(total);
            setIsOpen(false);
        }
    };

    const addOneMinute = () => {
        onAddMinute();
        setIsOpen(false);
    };

    const restartTimer = () => {
        onRestartTimer();
        setIsOpen(false);
    };

    const cancelTimer = () => {
        onCancelTimer();
        setIsOpen(false);
    };

    // Calculate progress for circular indicator
    const progress = totalTime > 0 ? timeLeft / totalTime : 0;

    if (!isHost) return null;

    return (
        <div className="relative">
            {/* Timer Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 ${isRunning
                    ? "bg-transparent"
                    : "bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60"
                    }`}
            >
                {isRunning ? (
                    // Circular progress for server-synced countdown
                    <svg width="40" height="40" style={{ transform: 'rotate(-90deg) scaleX(-1)' }}>
                        {/* Background circle (elapsed time - dark) */}
                        <circle
                            cx="20"
                            cy="20"
                            r="10"
                            fill="rgb(51, 65, 85)"
                            stroke="rgb(51, 65, 85)"
                            strokeWidth="20"
                        />
                        {/* Progress circle (remaining time - green pie) */}
                        <circle
                            cx="20"
                            cy="20"
                            r="10"
                            fill="transparent"
                            stroke="rgb(34, 197, 94)"
                            strokeWidth="20"
                            strokeDasharray={2 * Math.PI * 10}
                            strokeDashoffset={(2 * Math.PI * 10) * (1 - progress)}
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>
                ) : (
                    <Timer size={18} className="text-cyan-400" />
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                        >
                            {isRunning ? (
                                // Running state menu
                                <div className="p-2">
                                    <button
                                        onClick={addOneMinute}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                                    >
                                        <Plus size={18} className="text-cyan-400" />
                                        Add 1 minute
                                    </button>
                                    <button
                                        onClick={restartTimer}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                                    >
                                        <RotateCcw size={18} className="text-slate-400" />
                                        Restart
                                    </button>
                                    <button
                                        onClick={cancelTimer}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} className="text-red-400" />
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                // Setup state
                                <div className="p-4">
                                    <h3 className="text-white font-bold text-lg mb-4">Timer</h3>

                                    {/* Time inputs */}
                                    <div className="flex items-center justify-center gap-3 mb-4">
                                        <div className="text-center">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={minutes}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setMinutes(Math.min(59, parseInt(val) || 0));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="w-20 h-14 bg-slate-700 border border-slate-600 rounded-lg text-center text-2xl font-bold text-white focus:outline-none focus:border-cyan-500"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">Minutes</div>
                                        </div>
                                        <span className="text-2xl font-bold text-slate-500 mb-4">:</span>
                                        <div className="text-center">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={seconds}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setSeconds(Math.min(59, parseInt(val) || 0));
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="w-20 h-14 bg-slate-700 border border-slate-600 rounded-lg text-center text-2xl font-bold text-white focus:outline-none focus:border-cyan-500"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">Seconds</div>
                                        </div>
                                    </div>

                                    {/* Start button */}
                                    <button
                                        onClick={startTimer}
                                        disabled={minutes === 0 && seconds === 0}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Play size={18} fill="currentColor" />
                                        Start
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
