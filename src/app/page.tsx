"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PokerRoom from "@/components/PokerRoom";
import { AVATARS } from "@/components/AvatarSelector";
import { MountainSnow, ArrowRight, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { io } from "socket.io-client";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [roomParam, setRoomParam] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Join Mode State
  const [userName, setUserName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);

  // Create Mode State
  const [gameName, setGameName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const r = searchParams.get("room");
    if (r) {
      setRoomParam(r);

      // Check if we were already in this room
      const hasJoined = localStorage.getItem(`poker_joined_${r}`);
      const savedName = localStorage.getItem("poker_player_name");
      const savedAvatar = localStorage.getItem("poker_player_avatar");

      if (hasJoined === 'true' && savedName) {
        setUserName(savedName);
        if (savedAvatar) setAvatar(savedAvatar);
        setJoined(true);
      }
    } else {
      // Randomize avatar on client mount only if not auto-joining
      setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    }

    // Load saved name for convenience even if not auto-joining
    const savedName = localStorage.getItem("poker_player_name");
    if (savedName) setUserName(savedName);
  }, [searchParams]);

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameName.trim()) return; // Game name is required
    setIsCreating(true);

    const socket = io();
    socket.emit("create_room", { gameName });
    socket.on("room_created", ({ roomId, hostKey }) => {
      socket.disconnect();
      if (typeof hostKey === "string" && hostKey.length > 0) {
        localStorage.setItem(`room_host_key_${roomId}`, hostKey);
      }
      router.push(`/?room=${roomId}`);
    });
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;
    localStorage.setItem("poker_player_name", userName);
    localStorage.setItem("poker_player_avatar", avatar);

    if (roomParam) {
      localStorage.setItem(`poker_joined_${roomParam}`, 'true');
    }

    setJoined(true);
  };

  if (joined && roomParam) {
    return <PokerRoom roomId={roomParam} userName={userName} avatar={avatar} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1519681393798-2f43fef0c7c9?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-slate-900/20 pointer-events-none"></div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-3xl shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-cyan-500/10 p-4 rounded-2xl mb-4 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <MountainSnow size={48} className="text-cyan-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-2">Everest Poker</h1>
          <p className="text-slate-400 text-center text-sm font-medium">
            {roomParam ? "Join the Expedition" : "Start a New Climb"}
          </p>
        </div>

        {roomParam ? (
          // JOIN FORM
          <form onSubmit={handleJoinGame} className="space-y-5">
            {/* Avatar selection removed (auto-assigned) */}
            <input type="hidden" value={avatar} />

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Your Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Sherpa John"
                autoFocus
                required
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-medium placeholder:text-slate-600 valid:border-cyan-500/50"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              Enter Room <ArrowRight size={20} />
            </button>

            <div className="text-center">
              <button type="button" onClick={() => { setRoomParam(null); setIsCreating(false); setGameName(""); router.replace("/"); }} className="text-xs text-slate-500 hover:text-cyan-400 transition-colors">Start a new game instead</button>
            </div>
          </form>
        ) : (
          // CREATE FORM
          <form onSubmit={handleCreateGame} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Game Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g. Sprint 32 Planning"
                required
                autoFocus
                className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-medium placeholder:text-slate-600"
              />
            </div>

            <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 text-center">
                📊 Estimation Scale: <span className="text-cyan-400 font-semibold">Days (1-10)</span>
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-wait transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                {isCreating ? "Creating Base Camp..." : <><Plus size={20} /> Start Game</>}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
