import { useState } from "react";
import type { NoteCreate, NoteRead, NoteUpdate } from "../api/notes";

type Props = {
  initial?: NoteRead;
  onSave: (data: NoteCreate | NoteUpdate) => void;
  onCancel: () => void;
};

export function NoteEditor({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({ title, body, tags });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          {initial ? "編集" : "新規作成"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="タグ（カンマ区切り）"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="本文（Markdown）"
            className="w-full h-full min-h-64 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>
      </div>
    </form>
  );
}
