
"use client";

import React from "react";
import clsx from "clsx";
import { motion } from "framer-motion";

export const AVATARS = [
    "👽", "🤖", "👨‍🚀", "👾", "🛸", "👻", "🧟", "🧛",
    "🧙", "🐉", "🦄", "👺", "👹", "🐲", "🦍", "🐺",
    "🦊", "🦅", "🦉", "🦈", "🦖", "🐙", "🐅", "🦁"
];

interface AvatarSelectorProps {
    selectedAvatar: string;
    onSelect: (avatar: string) => void;
}

export default function AvatarSelector({ selectedAvatar, onSelect }: AvatarSelectorProps) {
    return (
        <div className="grid grid-cols-8 gap-2 mb-6">
            {AVATARS.map((avatar) => (
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    key={avatar}
                    onClick={() => onSelect(avatar)}
                    className={clsx(
                        "text-2xl w-10 h-10 flex items-center justify-center rounded-full transition-all",
                        selectedAvatar === avatar
                            ? "bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                            : "bg-slate-800 border border-slate-700 hover:bg-slate-700 grayscale hover:grayscale-0"
                    )}
                >
                    {avatar}
                </motion.button>
            ))}
        </div>
    );
}
