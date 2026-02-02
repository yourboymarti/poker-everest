"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConsensusConfettiProps {
    trigger: boolean;
    consensusValue?: string | null;
}

export default function ConsensusConfetti({ trigger, consensusValue }: ConsensusConfettiProps) {
    const hasTriggered = useRef(false);

    useEffect(() => {
        if (trigger && !hasTriggered.current) {
            hasTriggered.current = true;

            // Big celebration confetti burst
            const duration = 3000;
            const end = Date.now() + duration;

            const colors = ['#00d4ff', '#ff6b35', '#7c3aed', '#10b981', '#f59e0b'];

            (function frame() {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());

            // Center burst
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors
            });
        }

        // Reset trigger when voting restarts
        if (!trigger) {
            hasTriggered.current = false;
        }
    }, [trigger]);

    if (!trigger || !consensusValue) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="animate-bounce bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-4 rounded-2xl shadow-2xl text-center">
                <div className="text-2xl font-bold mb-1">🎉 CONSENSUS! 🎉</div>
                <div className="text-4xl font-black">{consensusValue}</div>
            </div>
        </div>
    );
}
