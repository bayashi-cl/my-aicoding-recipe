import type { components } from "mar-schema";

export type NoteRead = components["schemas"]["NoteRead"];
export type NoteCreate = components["schemas"]["NoteCreate"];
export type NoteUpdate = components["schemas"]["NoteUpdate"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function fetchNotes(): Promise<NoteRead[]> {
  return request<NoteRead[]>("/api/notes");
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
