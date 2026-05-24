import { request } from "./request";

export function fetchTags(): Promise<string[]> {
  return request<string[]>("/api/tags");
}
