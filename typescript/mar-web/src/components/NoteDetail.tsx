import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { NoteRead } from "../api/notes";

type Props = {
  note: NoteRead;
  onEdit: () => void;
  onDelete: () => void;
};

export function NoteDetail({ note, onEdit, onDelete }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-gray-200">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {note.title}
          </h1>
          {(note.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(note.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            編集
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            削除
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
      </div>
    </div>
  );
}
