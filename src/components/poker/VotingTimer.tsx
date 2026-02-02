"use client";

import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface VotingTimerProps {
    votingEndTime: number | null | undefined;
    onTimeUp?: () => void;
}

export default function VotingTimer({ votingEndTime, onTimeUp }: VotingTimerProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!votingEndTime) {
            setTimeLeft(0);
            return;
        }

        const updateTimer = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((votingEndTime - now) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0 && onTimeUp) {
                onTimeUp();
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [votingEndTime, onTimeUp]);

    if (!votingEndTime || timeLeft === 0) return null;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const isLow = timeLeft <= 10;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isLow ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' : 'bg-slate-700/50 border-slate-600 text-slate-300'}`}>
            <Timer size={16} className={isLow ? 'text-red-400' : 'text-cyan-400'} />
            <span className="font-mono font-bold text-lg">
                {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
        </div>
    );
}
