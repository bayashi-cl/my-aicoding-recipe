import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  createNote,
  deleteNote,
  fetchNotes,
  type NoteCreate,
  type NoteUpdate,
  updateNote,
} from "../api/notes";
import { fetchTags } from "../api/tags";
import { NoteDetail } from "../components/NoteDetail";
import { NoteEditor } from "../components/NoteEditor";
import { NoteList } from "../components/NoteList";
import { queryClient } from "../lib/queryClient";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

type Mode = "view" | "edit" | "new";

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function IndexPage() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const { data: notes = [] } = useQuery({
    queryKey: ["notes", debouncedQuery, selectedTag],
    queryFn: () =>
      fetchNotes(debouncedQuery || undefined, selectedTag ?? undefined),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: fetchTags,
  });

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  function clearFilters() {
    setSearchQuery("");
    setSelectedTag(null);
  }

  const createMutation = useMutation({
    mutationFn: (data: NoteCreate) => createNote(data),
    onSuccess: (created) => {
      clearFilters();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setSelectedNoteId(created.id);
      setMode("view");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: NoteUpdate }) =>
      updateNote(id, data),
    onSuccess: () => {
      clearFilters();
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setMode("view");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          tags={tags}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          filterDisabled={mode !== "view"}
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
