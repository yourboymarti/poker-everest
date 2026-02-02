"use client";

import clsx from "clsx";

interface VotingCardsProps {
    deck: string[];
    myVote: string | null;
    isRevealed: boolean;
    onVote: (card: string) => void;
}

export default function VotingCards({ deck, myVote, isRevealed, onVote }: VotingCardsProps) {
    return (
        <div className="w-full max-w-full overflow-x-auto px-2">
            <div className="flex items-center justify-start md:justify-center gap-1.5 md:gap-2 pb-2 min-w-max md:min-w-0">
                {deck.map((card) => (
                    <button
                        key={card}
                        onClick={() => onVote(card)}
                        disabled={isRevealed}
                        className={clsx(
                            "w-10 h-14 sm:w-11 sm:h-16 md:w-14 md:h-20 rounded-lg flex items-center justify-center text-base sm:text-lg font-bold transition-all transform active:scale-95 md:hover:-translate-y-2 md:hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex-shrink-0",
                            myVote === card
                                ? "bg-cyan-500 text-white ring-2 ring-cyan-400 -translate-y-1 md:-translate-y-2 shadow-lg shadow-cyan-500/50"
                                : "bg-slate-700 border border-slate-600 md:hover:bg-slate-600 text-slate-300"
                        )}
                    >
                        {card}
                    </button>
                ))}
            </div>
        </div>
    );
}
