import { useState } from "react";
import { Plus, ListTodo, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, EmptyState, getErrorMessage } from "./ShareSectionUtils";
import type { MenuTask } from "@/hooks/useMenuData";

interface TasksSectionProps {
  tasks: MenuTask[];
  onAddTask: (text: string) => Promise<MenuTask>;
  onToggleTask: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
}

export function TasksSection({ tasks, onAddTask, onToggleTask, onDeleteTask }: TasksSectionProps) {
  const [newTask, setNewTask] = useState("");
  const { toast } = useToast();

  const completedTasks = tasks.filter((t) => t.completed).length;

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    try {
      await onAddTask(newTask.trim());
      setNewTask("");
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleToggleTask = async (id: string) => {
    try {
      await onToggleTask(id);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await onDeleteTask(id);
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err) });
    }
  };

  return (
    <MenuContent
      title="Tareas"
      subtitle={tasks.length > 0 ? `${completedTasks}/${tasks.length} completadas` : "Organiza tu pendiente"}
    >
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Nueva tarea…"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/30"
        />
        <button onClick={handleAddTask} className="px-4 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-sm text-cyan-400 font-medium hover:bg-cyan-500/25 transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {tasks.length > 0 && (
        <div className="mb-4">
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${(completedTasks / tasks.length) * 100}%` }} />
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon={<ListTodo className="w-8 h-8" />} text="No tienes tareas pendientes" />
      ) : (
        <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 group ${
                task.completed
                  ? "bg-emerald-500/[0.03] border-emerald-500/10"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              <button
                onClick={() => handleToggleTask(task.id)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                  task.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-cyan-500"
                }`}
              >
                {task.completed && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span className={`flex-1 text-sm transition-all ${task.completed ? "text-slate-600 line-through" : "text-slate-300"}`}>
                {task.text}
              </span>
              <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </MenuContent>
  );
}