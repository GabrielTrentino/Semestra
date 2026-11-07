import { useState } from "react";
import {
  BookText,
  Code2,
  Play,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Course, Notebook, NotebookBlock } from "../../lib/types";
import { shell, type RunLanguage } from "../../lib/semestraBridge";

type Props = {
  notebook: Notebook;
  course?: Course;
  onChange: (next: Notebook) => void;
  onDelete?: () => void;
};

function newBlock(
  kind: NotebookBlock["kind"],
  course?: Course
): NotebookBlock {
  if (kind === "markdown") {
    return { id: crypto.randomUUID(), kind: "markdown", source: "" };
  }
  const language = guessLanguageForCourse(course);
  return {
    id: crypto.randomUUID(),
    kind: "code",
    language,
    source:
      language === "java"
        ? `System.out.println("Olá, mundo");`
        : `Console.WriteLine("Olá, mundo");`,
  };
}

function guessLanguageForCourse(course?: Course): RunLanguage {
  const name = (course?.name ?? "").toLowerCase();
  if (/java/.test(name)) return "java";
  if (/\.net|c#|csharp/.test(name)) return "csharp";
  return "csharp";
}

export function LessonNotebook({ notebook, course, onChange, onDelete }: Props) {
  const touch = (patch: Partial<Notebook>) =>
    onChange({
      ...notebook,
      ...patch,
      updatedAt: new Date().toISOString(),
    });

  const addBlock = (kind: NotebookBlock["kind"]) =>
    touch({ blocks: [...notebook.blocks, newBlock(kind, course)] });

  const updateBlock = (id: string, patch: Partial<NotebookBlock>) =>
    touch({
      blocks: notebook.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as NotebookBlock) : b
      ),
    });

  const deleteBlock = (id: string) =>
    touch({ blocks: notebook.blocks.filter((b) => b.id !== id) });

  const runBlock = async (block: NotebookBlock) => {
    if (block.kind !== "code") return;
    updateBlock(block.id, {
      lastRun: {
        at: new Date().toISOString(),
        stdout: "",
        stderr: "",
        exitCode: null,
        elapsedMs: 0,
        error: "Executando…",
      },
    } as Partial<NotebookBlock>);
    const result = await shell.runCode(block.language, block.source);
    updateBlock(block.id, {
      lastRun: { at: new Date().toISOString(), ...result },
    } as Partial<NotebookBlock>);
  };

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
          Notebook vazio. Adicione uma anotação ou bloco de código abaixo.
        </div>
      )}

      {notebook.blocks.map((b) => (
        <BlockEditor
          key={b.id}
          block={b}
          onChange={(p) => updateBlock(b.id, p)}
          onDelete={() => deleteBlock(b.id)}
          onRun={() => runBlock(b)}
        />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addBlock("markdown")}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
        >
          <BookText className="h-3.5 w-3.5" /> + Anotação
        </button>
        <button
          type="button"
          onClick={() => addBlock("code")}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
        >
          <Code2 className="h-3.5 w-3.5" /> + Código
        </button>
      </div>
    </div>
  );
}

export function BlockEditor({
  block,
  onChange,
  onDelete,
  onRun,
}: {
  block: NotebookBlock;
  onChange: (patch: Partial<NotebookBlock>) => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const [outputOpen, setOutputOpen] = useState(true);

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

  const run = block.lastRun;
  const running = run?.error === "Executando…";

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <header className="flex items-center gap-2 px-2 py-1 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
        <Code2 className="h-3 w-3" />
        <select
          value={block.language}
          onChange={(e) =>
            onChange({
              language: e.target.value as RunLanguage,
            } as Partial<NotebookBlock>)
          }
          className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5 text-[11px]"
        >
          <option value="csharp">C#</option>
          <option value="java">Java</option>
        </select>
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-600 text-white px-2 py-0.5 text-[11px] font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Rodar
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
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
        rows={Math.min(14, Math.max(3, block.source.split("\n").length + 1))}
        spellCheck={false}
        className="w-full resize-y border-0 bg-slate-950 text-slate-100 font-mono text-[12px] p-2 focus:outline-none"
      />
      {run && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setOutputOpen((v) => !v)}
            className="w-full flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            {outputOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Saída
            {run.exitCode !== null && (
              <span
                className={
                  run.exitCode === 0 ? "text-emerald-600" : "text-red-600"
                }
              >
                exit {run.exitCode}
              </span>
            )}
            {run.elapsedMs > 0 && (
              <span className="text-slate-400">· {run.elapsedMs} ms</span>
            )}
          </button>
          {outputOpen && (
            <pre className="whitespace-pre-wrap break-words max-h-60 overflow-auto text-[12px] font-mono px-2 py-1.5 bg-slate-50 dark:bg-slate-950">
              {run.error && (
                <div className="text-amber-700 dark:text-amber-400 mb-1">
                  ⚠ {run.error}
                </div>
              )}
              {run.stderr && (
                <div className="text-red-600 dark:text-red-400">
                  {run.stderr}
                </div>
              )}
              {run.stdout || (!run.error && !run.stderr && "(sem saída)")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
