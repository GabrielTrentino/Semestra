import { useState } from "react";
import {
  Building2,
  ClipboardPaste,
  Database,
  FolderOpen,
  X,
  Plus,
  Trash2,
  Save,
  Pencil,
} from "lucide-react";
import type { Course, Program, Term } from "../../lib/types";
import { WhatsAppImporter } from "../importer/WhatsAppImporter";
import { COURSE_PALETTE } from "../../lib/colors";

type Props = {
  programs: Program[];
  courses: Course[];
  terms: Term[];
  currentTermLabel?: string;
  dataFolder: string | null;
  onClose: () => void;
  onSaveProgram: (p: Program) => void;
  onDeleteProgram: (id: string) => void;
  onImportCourses: (newCourses: Course[]) => void;
  onExport: () => void;
  onImportBackup: () => void;
  onReset: () => void;
  onChangeDataFolder: () => Promise<unknown>;
  onRevealDataFolder: () => void;
};

type Section = "instituicoes" | "whatsapp" | "backup";

const SECTIONS: { id: Section; label: string; icon: typeof Building2 }[] = [
  { id: "instituicoes", label: "Instituições", icon: Building2 },
  { id: "whatsapp", label: "Importar do WhatsApp", icon: ClipboardPaste },
  { id: "backup", label: "Backup e dados", icon: Database },
];

export function SettingsPanel(props: Props) {
  const [section, setSection] = useState<Section>("instituicoes");
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-start justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="w-full max-w-4xl h-[92vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl grid grid-cols-[180px_1fr] grid-rows-[1fr]">
        <aside className="border-r border-slate-200 dark:border-slate-800 p-3 space-y-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto min-h-0">
          <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-500">
            Configurações
          </div>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left ${
                section === id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </aside>
        <div className="overflow-y-auto min-h-0">
          <header className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
            <h2 className="text-base font-semibold">
              {SECTIONS.find((s) => s.id === section)?.label}
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              className="ml-auto p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="p-4">
            {section === "instituicoes" && (
              <ProgramsEditor
                programs={props.programs}
                onSave={props.onSaveProgram}
                onDelete={props.onDeleteProgram}
              />
            )}
            {section === "whatsapp" && (
              <WhatsAppImporter
                programId={props.programs[0]?.id}
                programs={props.programs}
                existingCount={props.courses.length}
                terms={props.terms}
                currentTermLabel={props.currentTermLabel}
                onImport={(cs) => {
                  props.onImportCourses(cs);
                  props.onClose();
                }}
              />
            )}
            {section === "backup" && (
              <BackupSection
                dataFolder={props.dataFolder}
                onExport={props.onExport}
                onImport={props.onImportBackup}
                onReset={props.onReset}
                onChangeDataFolder={props.onChangeDataFolder}
                onRevealDataFolder={props.onRevealDataFolder}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgramsEditor({
  programs,
  onSave,
  onDelete,
}: {
  programs: Program[];
  onSave: (p: Program) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Program>>({});
  const [adding, setAdding] = useState(false);

  const startEdit = (p: Program) => {
    setEditingId(p.id);
    setDraft({ ...p });
    setAdding(false);
  };
  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft({
      id: crypto.randomUUID(),
      name: "",
      institution: "",
      color:
        COURSE_PALETTE[programs.length % COURSE_PALETTE.length],
      calendarId: null,
    });
  };
  const save = () => {
    if (!draft.name || !draft.institution || !draft.id) return;
    onSave(draft as Program);
    setDraft({});
    setEditingId(null);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Cadastre cada formação/instituição (graduação, pós, MBA, curso livre).
        A instituição aparece em todas as outras telas pra filtrar o que você
        quer ver.
      </p>

      <ul className="space-y-2">
        {programs.map((p) => {
          const editing = editingId === p.id;
          return (
            <li
              key={p.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
              style={{ borderLeftColor: p.color, borderLeftWidth: 4 }}
            >
              {editing ? (
                <ProgramForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={save}
                  onCancel={() => {
                    setDraft({});
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.institution}
                      {p.calendarId && ` · calendário ${p.calendarId}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Remover "${p.name}"? As disciplinas não serão apagadas, mas ficarão sem instituição.`
                        )
                      )
                        onDelete(p.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="rounded-lg border border-slate-300 dark:border-slate-700 p-3">
          <ProgramForm
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onCancel={() => {
              setDraft({});
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Adicionar instituição
        </button>
      )}
    </div>
  );
}

function ProgramForm({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Partial<Program>;
  setDraft: (p: Partial<Program>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nome da formação (ex.: Pós em Gestão de TI)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <input
          value={draft.institution ?? ""}
          onChange={(e) => setDraft({ ...draft, institution: e.target.value })}
          placeholder="Instituição (ex.: FGV)"
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        />
        <select
          value={draft.calendarId ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              calendarId:
                e.target.value === "infnet-2026" ? "infnet-2026" : null,
            })
          }
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-sm"
        >
          <option value="">Sem calendário (eventos pontuais)</option>
          <option value="infnet-2026">INFNET — Graduação 2026</option>
        </select>
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-xs text-slate-500">Cor:</span>
          {COURSE_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft({ ...draft, color: c })}
              className={`h-5 w-5 rounded-full ${
                draft.color === c
                  ? "ring-2 ring-slate-900 dark:ring-white"
                  : ""
              }`}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.name || !draft.institution}
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-xs disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> Salvar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function BackupSection({
  dataFolder,
  onExport,
  onImport,
  onReset,
  onChangeDataFolder,
  onRevealDataFolder,
}: {
  dataFolder: string | null;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onChangeDataFolder: () => Promise<unknown>;
  onRevealDataFolder: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
        <div className="flex items-center gap-2 text-sm font-medium mb-1">
          <FolderOpen className="h-4 w-4" />
          Pasta de dados
        </div>
        <div className="text-xs text-slate-500 mb-2">
          Arquivo <code>semestra-data.json</code> fica dentro desta pasta.
          Mudar a pasta migra os dados atuais pra nova localização.
        </div>
        <div className="font-mono text-xs break-all bg-slate-100 dark:bg-slate-900 rounded p-2 mb-2">
          {dataFolder ?? "(não definido)"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onChangeDataFolder}
            className="rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-1.5 text-xs"
          >
            Trocar pasta…
          </button>
          {dataFolder && (
            <button
              type="button"
              onClick={onRevealDataFolder}
              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs"
            >
              Abrir pasta
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Exporte um JSON de backup periodicamente — ele contém disciplinas,
        aulas, notebooks e eventos.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-sm"
        >
          Exportar backup (.json)
        </button>
        <button
          type="button"
          onClick={onImport}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          Importar backup (.json)
        </button>
      </div>
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="text-sm font-medium text-red-600">Zona perigosa</div>
        <p className="text-xs text-slate-500 mt-1">
          Apaga tudo (disciplinas, aulas, notebooks, eventos). Não há como
          desfazer sem um backup.
        </p>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "Apagar todos os dados locais? Isso não pode ser desfeito."
              )
            )
              onReset();
          }}
          className="mt-2 rounded-md border border-red-300 dark:border-red-900 text-red-600 px-3 py-1.5 text-sm"
        >
          Limpar todos os dados
        </button>
      </div>
    </div>
  );
}
