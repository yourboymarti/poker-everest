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
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskName.trim()) {
            onAddTask(e);
            setIsAddingTask(false);
        }
    };

    const handleCancel = () => {
        setIsAddingTask(false);
        onNewTaskChange("");
    };

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

            {/* Sidebar - Hidden on mobile */}
            <motion.div
                animate={{
                    width: isOpen ? 280 : 0,
                    x: isOpen ? 0 : -280,
                    opacity: isOpen ? 1 : 0,
                }}
                transition={{ type: "tween", duration: 0.2 }}
                className="hidden md:flex fixed md:relative left-0 top-0 h-full md:h-full bg-slate-800 border-r border-slate-700 flex-col overflow-hidden z-50 md:z-auto"
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
                    {/* Add Task Button / Form */}
                    {isAdmin && (
                        <AnimatePresence mode="wait">
                            {isAddingTask ? (
                                <motion.form
                                    key="form"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={handleSubmit}
                                    className="mb-3"
                                >
                                    <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                        <textarea
                                            value={newTaskName}
                                            onChange={(e) => onNewTaskChange(e.target.value)}
                                            placeholder="Enter a title for the task"
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors resize-none min-h-[80px] text-slate-200 placeholder-slate-500"
                                            autoFocus
                                        />
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                type="button"
                                                onClick={handleCancel}
                                                className="flex-1 py-2 px-4 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!newTaskName.trim()}
                                                className="flex-1 py-2 px-4 rounded-lg bg-cyan-500 text-slate-900 font-bold hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                </motion.form>
                            ) : (
                                <motion.button
                                    key="button"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    type="button"
                                    onClick={() => setIsAddingTask(true)}
                                    className="w-full p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-400 font-medium flex items-center gap-3 hover:bg-slate-700 hover:text-slate-300 hover:border-slate-500 transition-colors mb-3"
                                >
                                    <Plus size={18} />
                                    Add a task
                                </motion.button>
                            )}
                        </AnimatePresence>
                    )}

                    {/* Task List */}
                    {tasks.map(task => (
                        <div
                            key={task.id}
                            className={`rounded-lg border overflow-hidden flex flex-col transition-all ${currentTask === task.name
                                ? "bg-cyan-900/30 border-cyan-500/50"
                                : "bg-slate-700/30 border-slate-700"
                                }`}
                        >
                            <div
                                className="p-2.5 md:p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-700/50 transition-colors"
                                onClick={() => {
                                    console.log("Task clicked:", task.id, "Name:", task.name);
                                    console.log("Task voteDetails:", JSON.stringify(task.voteDetails));
                                    console.log("Full task object keys:", Object.keys(task));
                                    setExpandedTaskId(expandedTaskId === task.id ? null : task.id);
                                }}
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
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    {isAdmin && (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                                {expandedTaskId === task.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-slate-700 bg-slate-800/50"
                                    >
                                        <div className="p-3 space-y-1.5">
                                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
                                                Voting History
                                            </div>
                                            {task.voteDetails ? (
                                                <>
                                                    {task.voteDetails.map((detail, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-xs">
                                                            <span className="text-slate-400 truncate mr-2">{detail.playerName}</span>
                                                            <span className={`font-bold ${detail.vote ? "text-cyan-400" : "text-slate-600 italic"}`}>
                                                                {detail.vote || "Did not vote"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {task.voteDetails.length === 0 && (
                                                        <div className="text-[10px] text-slate-600 italic">No voting details captured</div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-[10px] text-slate-600 italic">No voting history yet for this task. Reveal and reset to see details.</div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}

                    {tasks.length === 0 && !isAddingTask && (
                        <div className="text-slate-500 text-xs md:text-sm text-center italic py-4">No tasks yet</div>
                    )}
                </div>
            </motion.div>
        </>
    );
}
