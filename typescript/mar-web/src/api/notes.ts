import type { components } from "mar-schema";
import { request } from "./request";

export type NoteRead = components["schemas"]["NoteRead"];
export type NoteCreate = components["schemas"]["NoteCreate"];
export type NoteUpdate = components["schemas"]["NoteUpdate"];

export function fetchNotes(q?: string, tag?: string): Promise<NoteRead[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const qs = params.size > 0 ? `?${params.toString()}` : "";
  return request<NoteRead[]>(`/api/notes${qs}`);
}

export function createNote(data: NoteCreate): Promise<NoteRead> {
  return request<NoteRead>("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updateNote(id: string, data: NoteUpdate): Promise<NoteRead> {
  return request<NoteRead>(`/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteNote(id: string): Promise<void> {
  return request<void>(`/api/notes/${id}`, { method: "DELETE" });
}
