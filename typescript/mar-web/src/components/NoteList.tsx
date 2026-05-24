import type { NoteRead } from "../api/notes";

type Props = {
  notes: NoteRead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function NoteList({ notes, selectedId, onSelect, onNew }: Props) {
  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      <div className="p-3 border-b border-gray-200">
        <button
          type="button"
          onClick={onNew}
          className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          新規作成
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => onSelect(note.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                selectedId === note.id
                  ? "bg-blue-50 border-l-2 border-l-blue-500"
                  : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-800 truncate">
                {note.title}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(note.updated_at).toLocaleString("ja-JP")}
              </div>
            </button>
          </li>
        ))}
        {notes.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-400 text-center">
            ノートがありません
          </li>
        )}
      </ul>
    </div>
  );
}
