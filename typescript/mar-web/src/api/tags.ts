export async function fetchTags(): Promise<string[]> {
  const res = await fetch("/api/tags");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<string[]>;
}
