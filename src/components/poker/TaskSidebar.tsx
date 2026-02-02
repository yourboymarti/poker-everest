"use client";

import { useState } from "react";
import { Task } from "@/types/room";
import { motion, AnimatePresence } from "framer-motion";
import { List, ChevronLeft, Play, Plus, X, Trash2, AlertCircle } from "lucide-react";

interface TaskSidebarProps {
    tasks: Task[];
    currentTask: string;
    isAdmin: boolean;
    isOpen: boolean;
    newTaskName: string;
    onClose: () => void;
    onNewTaskChange: (value: string) => void;
    onAddTask: (e: React.FormEvent) => void;
    onDeleteTask: (taskId: string) => void;
    onStartVoting: (taskId: string) => void;
}

export default function TaskSidebar({
    tasks,
    currentTask,
    isAdmin,
    isOpen,
    newTaskName,
    onClose,
    onNewTaskChange,
    onAddTask,
    onDeleteTask,
    onStartVoting,
}: TaskSidebarProps) {
    const [confirmId, setConfirmId] = useState<string | null>(null);

    return (
        <>
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.div
                animate={{
                    width: isOpen ? 280 : 0,
                    x: isOpen ? 0 : -280,
                    opacity: isOpen ? 1 : 0,
                }}
                transition={{ type: "tween", duration: 0.2 }}
                className="fixed md:relative left-0 top-0 h-full md:h-full bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden z-50 md:z-auto"
            >
                <div className="p-3 md:p-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
                        <List size={16} className="md:w-[18px] md:h-[18px]" /> Tasks
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 -mr-1">
                        <X size={18} className="md:hidden" />
                        <ChevronLeft size={18} className="hidden md:block" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className={`p-2.5 md:p-3 rounded-lg border flex items-center justify-between gap-2 ${currentTask === task.name
                                ? "bg-cyan-900/30 border-cyan-500/50"
                                : "bg-slate-700/30 border-slate-700"
                                }`}
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`text-xs md:text-sm font-medium truncate ${currentTask === task.name ? "text-cyan-300" : "text-slate-300"}`}>
                                    {task.name}
                                </span>
                                {task.score && (
                                    <span className="bg-cyan-500/20 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold">
                                        {task.score}
                                    </span>
                                )}
                            </div>
                            {isAdmin && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onStartVoting(task.id)}
                                        className="p-2 md:p-1.5 rounded bg-cyan-600 text-white transition-colors hover:bg-cyan-500 flex-shrink-0"
                                        title="Start Voting"
                                    >
                                        <Play size={12} fill="currentColor" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirmId === task.id) {
                                                onDeleteTask(task.id);
                                                setConfirmId(null);
                                            } else {
                                                setConfirmId(task.id);
                                                setTimeout(() => setConfirmId(null), 3000);
                                            }
                                        }}
                                        className={`p-2 md:p-1.5 rounded transition-colors flex-shrink-0 ${confirmId === task.id
                                                ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
                                                : "bg-slate-700 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
                                            }`}
                                        title={confirmId === task.id ? "Click again to confirm" : "Delete Task"}
                                    >
                                        {confirmId === task.id ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="text-slate-500 text-xs md:text-sm text-center italic py-4">No tasks yet</div>
                    )}
                </div>

                {isAdmin && (
                    <form onSubmit={onAddTask} className="p-3 md:p-4 border-t border-slate-700 bg-slate-800/50">
                        <div className="relative">
                            <input
                                type="text"
                                value={newTaskName}
                                onChange={(e) => onNewTaskChange(e.target.value)}
                                placeholder="New Task..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                            />
                            <button type="submit" className="absolute right-1 top-1 p-1.5 md:p-1 bg-slate-700 rounded hover:bg-cyan-600 text-white transition-colors" disabled={!newTaskName.trim()}>
                                <Plus size={14} className="md:w-4 md:h-4" />
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </>
    );
}
