import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  createNote,
  deleteNote,
  fetchNotes,
  type NoteCreate,
  type NoteUpdate,
  updateNote,
} from "../api/notes";
import { NoteDetail } from "../components/NoteDetail";
import { NoteEditor } from "../components/NoteEditor";
import { NoteList } from "../components/NoteList";
import { queryClient } from "../lib/queryClient";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

type Mode = "view" | "edit" | "new";

function IndexPage() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  const { data: notes = [] } = useQuery({
    queryKey: ["notes"],
    queryFn: fetchNotes,
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  const createMutation = useMutation({
    mutationFn: (data: NoteCreate) => createNote(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedNoteId(created.id);
      setMode("view");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdate }) =>
      updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setMode("view");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setSelectedNoteId(null);
      setMode("view");
    },
  });

  function handleSave(data: NoteCreate | NoteUpdate) {
    if (selectedNoteId && mode === "edit") {
      updateMutation.mutate({ id: selectedNoteId, data: data as NoteUpdate });
    } else {
      createMutation.mutate(data as NoteCreate);
    }
  }

  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0">
        <NoteList
          notes={notes}
          selectedId={selectedNoteId}
          onSelect={(id) => {
            setSelectedNoteId(id);
            setMode("view");
          }}
          onNew={() => {
            setSelectedNoteId(null);
            setMode("new");
          }}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "new" && (
          <NoteEditor onSave={handleSave} onCancel={() => setMode("view")} />
        )}
        {mode === "edit" && selectedNote && (
          <NoteEditor
            initial={selectedNote}
            onSave={handleSave}
            onCancel={() => setMode("view")}
          />
        )}
        {mode === "view" && selectedNote && (
          <NoteDetail
            note={selectedNote}
            onEdit={() => setMode("edit")}
            onDelete={() => deleteMutation.mutate(selectedNote.id)}
          />
        )}
        {mode === "view" && !selectedNote && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            左からノートを選んでください
          </div>
        )}
      </div>
    </div>
  );
}
