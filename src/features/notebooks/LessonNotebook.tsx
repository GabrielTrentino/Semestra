import { BookText, Trash2 } from "lucide-react";
import type { Course, Notebook, NotebookBlock } from "../../lib/types";

type Props = {
  notebook: Notebook;
  course?: Course;
  onChange: (next: Notebook) => void;
  onDelete?: () => void;
};

function newMarkdownBlock(): NotebookBlock {
  return { id: crypto.randomUUID(), kind: "markdown", source: "" };
}

export function LessonNotebook({ notebook, onChange, onDelete }: Props) {
  const touch = (patch: Partial<Notebook>) =>
    onChange({
      ...notebook,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

  const addMarkdown = () =>
    touch({ blocks: [...notebook.blocks, newMarkdownBlock()] });

  const updateBlock = (id: string, patch: Partial<NotebookBlock>) =>
    touch({
      blocks: notebook.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as NotebookBlock) : b
      ),
    });

  const deleteBlock = (id: string) =>
    touch({ blocks: notebook.blocks.filter((b) => b.id !== id) });

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 space-y-3">
      <header className="flex items-center gap-2">
        <input
          value={notebook.title}
          onChange={(e) => touch({ title: e.target.value })}
          className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm font-medium"
        />
        {onDelete && notebook.blocks.length === 0 && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
            title="Apagar notebook vazio"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {notebook.blocks.length === 0 && (
        <div className="text-xs text-slate-500 text-center py-2">
          Notebook vazio. Adicione uma anotação abaixo.
        </div>
      )}

      {notebook.blocks.map((b) => (
        <BlockEditor
          key={b.id}
          block={b}
          onChange={(p) => updateBlock(b.id, p)}
          onDelete={() => deleteBlock(b.id)}
        />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addMarkdown}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
        >
          <BookText className="h-3.5 w-3.5" /> + Anotação
        </button>
      </div>
    </div>
  );
}

export function BlockEditor({
  block,
  onChange,
  onDelete,
}: {
  block: NotebookBlock;
  onChange: (patch: Partial<NotebookBlock>) => void;
  onDelete: () => void;
}) {
  if (block.kind === "markdown") {
    return (
      <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <header className="flex items-center gap-2 px-2 py-1 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
          <BookText className="h-3 w-3" />
          Anotação
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
            title="Remover bloco"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </header>
        <textarea
          value={block.source}
          onChange={(e) =>
            onChange({ source: e.target.value } as Partial<NotebookBlock>)
          }
          placeholder="Anotação em Markdown…"
          rows={3}
          spellCheck={false}
          className="w-full resize-y border-0 bg-transparent p-2 text-sm focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <header className="flex items-center gap-2 px-2 py-1 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        <span className="font-mono">{block.language}</span>
        <span className="text-slate-400">· bloco legado (somente leitura)</span>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
          title="Remover bloco"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </header>
      <pre className="whitespace-pre-wrap break-words bg-slate-950 text-slate-100 font-mono text-[12px] p-2 m-0">
        {block.source}
      </pre>
    </div>
  );
}
