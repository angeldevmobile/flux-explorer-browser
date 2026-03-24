import { useState } from "react";
import { Plus, StickyNote, Globe, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, EmptyState, getErrorMessage } from "./ShareSectionUtils";
import type { MenuNote } from "@/hooks/useMenuData";

const NOTE_COLORS = [
  "from-amber-500/15 to-yellow-500/10 border-amber-500/20",
  "from-cyan-500/15 to-teal-500/10 border-cyan-500/20",
  "from-violet-500/15 to-purple-500/10 border-violet-500/20",
  "from-rose-500/15 to-pink-500/10 border-rose-500/20",
  "from-emerald-500/15 to-green-500/10 border-emerald-500/20",
];

interface NotesSectionProps {
  notes: MenuNote[];
  currentUrl: string;
  onAddNote: (text: string, url: string, color: string) => Promise<MenuNote>;
  onDeleteNote: (id: string) => Promise<void>;
}

export function NotesSection({ notes, currentUrl, onAddNote, onDeleteNote }: NotesSectionProps) {
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
      await onAddNote(newNote.trim(), currentUrl, color);
      setNewNote("");
      toast({ title: "Nota guardada" });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err) });
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await onDeleteNote(id);
    } catch (err: unknown) {
      toast({ title: "Error al eliminar nota", description: getErrorMessage(err) });
    }
  };

  return (
    <MenuContent title="Notas rápidas" subtitle="Guarda ideas mientras navegas">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Escribe una nota…"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
          className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/30"
        />
        <button onClick={handleAddNote} className="px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/20 text-sm text-amber-400 font-medium hover:bg-amber-500/25 transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={<StickyNote className="w-8 h-8" />} text="No tienes notas aún" />
      ) : (
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {notes.map((note) => (
            <div key={note.id} className={`p-3 rounded-xl bg-gradient-to-br border group transition-all duration-200 hover:scale-[1.01] ${note.color || NOTE_COLORS[0]}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm text-slate-300 leading-relaxed">{note.text}</p>
                <button onClick={() => handleDeleteNote(note.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all flex-shrink-0 mt-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3 h-3 text-slate-600" />
                <span className="text-[10px] text-slate-600 truncate max-w-[200px]">
                  {note.url.replace(/^https?:\/\//, "").split("/")[0]}
                </span>
                <span className="text-[10px] text-slate-700">•</span>
                <span className="text-[10px] text-slate-600">
                  {new Date(note.createdAt).toLocaleString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </MenuContent>
  );
}